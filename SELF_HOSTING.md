# CatCare: Self-Hosting Migration Guide

> **Status: Active — this is the current, daily-use deployment.** The
> Render/Vercel/Supabase-Cloud stack this guide migrates away from
> (`DEPLOY.md`) is dormant/paused, not decommissioned — see `CLAUDE.md`'s
> `## Deployment Status` for how the two coexist in the same codebase, and
> `## Non-Negotiable Rules` / Common Mistake #18 for why online-specific
> code/config must not be removed just because it's unused day to day.
>
> **Open item — git remotes are backwards from this guide's intent:**
> `origin` (`synergyx26/CatCare`) is what `DEPLOY.md` treats as the
> online-stack repo, and `selfhosted` (`synergyx26/CatCare-selfhosted`) is
> meant to be where local/Proxmox-specific work lives — but in practice the
> recent self-hosted-specific commits (name+password login, blob-service
> photo URL fix, self-hosted CSP host) landed on `origin/master`, and
> `selfhosted/master` is stale. Local `master` still tracks `origin`. Not
> yet fixed; do the remote/tracking cleanup deliberately before relying on
> either remote being "the self-hosted one."

---

## Operations runbook — the current Proxmox LXC deployment (read this first)

Everything below describes what is actually running at `192.168.20.20`. The
long migration guide further down (Phases 1–9) is the original Supabase-era
plan and is kept for reference; where it disagrees with this section, this
section wins.

### What runs where

One LXC, one Docker Compose project in `/opt/catcare` (source of truth lives in
the sibling `proxmox-homelab` repo under `catcare/`):

| Container | Role | Reachable at |
|---|---|---|
| `postgres` (17) | Database, volume `postgres_data` | internal only |
| `redis` (7) | Sidekiq + cache | internal only |
| `api` | Rails API (Thruster → Puma) | `http://192.168.20.20:3000` |
| `sidekiq` | Background jobs + cron (reminders, nightly backup) | internal |
| `web` | nginx serving the **HTTP** web build; also `/ca.crt`, `/catcare-ca.mobileconfig`, `/trust.html` | `http://192.168.20.20:8090` |
| `caddy` | **HTTPS** front, own CA (`tls internal`): `/api`, `/health`, `/rails` → api, everything else → the **HTTPS** web build | `https://192.168.20.20:8443` |

Files on the LXC (`/opt/catcare`): `docker-compose.yml`, `nginx.conf`,
`Caddyfile`, `.env` (secrets, mode 600 — never commit), `web-dist/` (HTTP
build), `web-dist-https/` (HTTPS build), `storage/` (photos + in-app backups,
bind-mounted into **both** api and sidekiq), `backups/` (host-level backups),
`caddy-root.crt` + `catcare-ca.mobileconfig` (the CA phones install),
`backup-db.sh`, `rollback.sh`, `rollback/<snapshot>/`.

### Feature flags and env (self-hosted values)

| Where | Variable | Purpose |
|---|---|---|
| web build | `VITE_LOCAL_ACCOUNTS_ENABLED`, `VITE_PLAYFUL_UI_ENABLED`, `VITE_SIDEBAR_NAV_ENABLED` | UI feature gates (see below for the sidebar default) |
| web build | `VITE_HTTPS_URL` | `https://192.168.20.20:8443` — only drives the "set up this device" hint on the HTTP site |
| web build | `VITE_API_URL` | HTTP build: `http://192.168.20.20:3000`. HTTPS build: `https://192.168.20.20:8443` (set by the deploy script) |
| api + sidekiq `.env` | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push keys. **Never regenerate casually** — every registered device would stop receiving until it re-subscribes. Unset = push off, inbox still works. Optional `VAPID_SUBJECT` |
| api + sidekiq `.env` | `SUPER_ADMIN_EMAIL` | Who gets backup notifications and `/admin/*` |
| api `.env` | `FORCE_SSL=false`, `CORS_ORIGINS`, `APP_HOST`, `LOCAL_ACCOUNTS_ENABLED` | As before. The HTTPS origin is same-origin through Caddy so it needs no CORS entry |

### Deploying

Run from `proxmox-homelab/scripts/` (it builds the API image on the LXC, builds
**both** web variants locally, ships them and recreates `api sidekiq web caddy`):

```bash
# Normal case: a clean checkout of what's committed (never deploy half-finished work by accident)
git worktree add --detach /tmp/catcare-deploy HEAD
ln -s "$PWD/web/node_modules" /tmp/catcare-deploy/web/node_modules
CATCARE_REPO=/tmp/catcare-deploy ~/Documents/Proxmox/proxmox-homelab/scripts/deploy-catcare.sh
git worktree remove --force /tmp/catcare-deploy
```

`./deploy-proxmox.sh` in this repo is the one-command variant but it first runs
`ship.sh`, which **commits and pushes everything in the working tree** — only
use it when you actually want that. The API image build is cached, so a deploy
with no Gemfile change takes well under a minute.

**Take a snapshot first for anything risky** (config, schema, new containers):

```bash
ssh root@192.168.20.20 'set -e; cd /opt/catcare; SNAP=/opt/catcare/rollback/pre-<what>-$(date -u +%Y%m%dT%H%M%SZ); mkdir -p $SNAP
/opt/catcare/backup-db.sh >/dev/null && cp "$(ls -t backups/pgdump/catcare-*.dump | head -1)" $SNAP/db.dump
cp docker-compose.yml nginx.conf Caddyfile $SNAP/; cp .env $SNAP/env
tar -czf $SNAP/web-dist.tar.gz -C web-dist .; tar -czf $SNAP/web-dist-https.tar.gz -C web-dist-https .
docker tag catcare-api:latest catcare-api:pre-<what> && echo catcare-api:pre-<what> > $SNAP/image.tag
echo $SNAP > rollback/LATEST'
```

### Rollback

```bash
ssh root@192.168.20.20 '/opt/catcare/rollback.sh "$(cat /opt/catcare/rollback/LATEST)"'
# add --drop-tables to also remove the notification tables (destructive; off by default)
```

Restores compose/nginx/`.env`/web build and the previous API image, removes the
`caddy` container if the snapshot predates it, recreates the containers and
waits for `/health`. Migrations only ever **add** tables, which the previous
release ignores, so leaving the database alone is safe. For a real data
restore use the dump in the snapshot:
`docker compose exec -T postgres pg_restore --clean --no-owner -U catcare -d catcare_production < db.dump`.

### Backups — four layers (all nightly, all on the LXC)

| What | When | Where | Notes |
|---|---|---|---|
| In-app export (zip of every table as CSV) | 03:00 UTC, sidekiq-cron | Active Storage → `/opt/catcare/storage`, **`/admin/backups`** to list/download/"Back up now" | Keeps 30 days (never prunes the newest good one); super admins are notified on success **and** failure |
| Rake CSV export | 03:00 | `/opt/catcare/backups/csv/<stamp>/` | Original mechanism, kept as a second copy |
| `pg_dump -Fc` + photos tarball | 03:10 (`/opt/catcare/backup-db.sh`) | `/opt/catcare/backups/pgdump/` | The only layer that is a faithful `pg_restore`; verified readable before it is kept |
| Proxmox `vzdump` of the whole LXC | per `infra/backup-job.tf` | host `local` storage | See the homelab repo |

**Still a single disk:** all four live on the same host. An off-box copy
(NAS / Tailscale peer / object storage) and a periodic **restore test** are
open items in `NEXT_STEPS.md`. The GitHub "Database Backup" workflow targets
the *online* Supabase database and is skipped unless the repo variable
`ONLINE_DB_BACKUP_ENABLED` is `true`.

### HTTPS, certificates and phones (needed for push notifications)

Browsers only allow service workers and Web Push on a secure context, so push
works only on `https://192.168.20.20:8443`. Caddy issues certificates from its
own CA, so each device must trust that CA **once**:

1. Open `http://192.168.20.20:8090/trust.html` on the phone (it detects iPhone vs Android and shows a live "this device trusts CatCare" check).
2. **iPhone/iPad:** in **Safari**, download the profile → Settings → *Profile Downloaded* → Install → then Settings → General → About → **Certificate Trust Settings** → enable *Caddy Local Authority*. (That last row only exists once the profile is installed.) Then open the HTTPS address, **Add to Home Screen**, and open CatCare from the icon — iOS only allows push for installed web apps.
3. **Android:** download `/ca.crt` → Settings → Security → Install a certificate → CA certificate; open the HTTPS address in Chrome.
4. In the app: Settings → Notifications → Push → **Enable on this device** → **Send test notification**. The HTTPS origin has its own login.

Keep the `caddy_data` Docker volume: it holds the CA. If it is lost, a new CA
is generated and every phone must re-trust it. The root is valid until 2036.
Regenerate the iOS profile after any CA change with
`proxmox-homelab/scripts/catcare-make-ca-profile.sh <root.crt> <out.mobileconfig>`
(the deploy script does this automatically if the file is missing).

### Notifications, in one paragraph

Everything funnels through `Notifications::Notifier`: an inbox row for the user
(bell + `/notifications`) plus Web Push to each registered device when the
user's push preference and the category allow it. Care events and every kind of
"added" record (cat, member, note, expense, trip, reminder, chores) notify the
rest of the household; bursts from one person fold into one notification.
Per-category switches and "Turn everything on" are in Settings → Notifications →
Push. Developer detail: `CLAUDE.md` → Infrastructure → *Notifications*.

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| iPhone has no "Certificate Trust Settings" row | The profile isn't installed yet. Use **Safari** (not Chrome/in-app), tap Allow, then Settings → Profile Downloaded → Install. The row appears only afterwards |
| `/ca.crt` or the profile returns 403 | File permissions on the LXC: `chmod 644 /opt/catcare/caddy-root.crt /opt/catcare/catcare-ca.mobileconfig` |
| `https://…:8443` refuses connections | Caddy listens on **8443 inside the container**; compose must map `8443:8443` (not `8443:443`) |
| Browser says certificate invalid | Device hasn't trusted the CA (see above), or you opened the IP via a different hostname — use exactly `https://192.168.20.20:8443` |
| "Enable on this device" is greyed with a message | The card tells you why: plain HTTP, browser unsupported (iPhone not added to Home Screen), permission denied, or push not configured (VAPID keys missing) |
| Test notification works but nothing on one phone | That phone must enable push itself (per-device). On iOS also confirm it was opened from the Home Screen icon |
| `/admin/backups` download 404s | api and sidekiq must mount the same `./storage` (compose) |

This guide covers migrating CatCare from its current cloud stack to a fully self-hosted setup on your home network, including a live database migration from Supabase Cloud to self-hosted Supabase.

> **Deploying to the Proxmox homelab box (`192.168.20.50`)?** Use the
> automated path in `../../Proxmox/proxmox-homelab/` instead — see its
> README's "CatCare — dedicated LXC" section and
> `scripts/deploy-catcare.sh`. That path runs plain PostgreSQL rather than
> the full self-hosted Supabase stack described below (Phase 1), since
> CatCare's auth is Devise/JWT end-to-end and Active Storage never actually
> used Supabase Storage in practice (see `NEXT_STEPS.md`) — the full
> Supabase stack (~10 containers: Kong, GoTrue, Realtime, Studio,
> Analytics, MinIO...) isn't worth the RAM on an 8GB box. Phase 2
> (pg_dump/pg_restore) below still applies for migrating real data; skip
> Phases 1, 4-8 (the LXC's docker-compose.yml/Ansible already cover that
> ground) and Phase 5 (no photos to migrate per `NEXT_STEPS.md`).

---

## Services Map: Cloud → Self-Hosted

| Service | Currently | Self-Hosted Replacement |
|---|---|---|
| PostgreSQL | Supabase Cloud | Self-hosted Supabase (Docker) |
| File Storage | Render ephemeral disk | Supabase Storage (Docker/MinIO) |
| Rails API | Render.com | Docker container (home server) |
| Sidekiq workers | Render.com Procfile worker | Docker container (home server) |
| Redis | Upstash | Redis Docker container |
| Frontend | Vercel | Nginx Docker container |
| Email | Resend API | **No change — Resend is an API key, nothing to host** |

---

## Prerequisites

### Hardware Requirements

- Home server or spare machine (Ubuntu 22.04 LTS recommended)
- Minimum: 4 GB RAM, 2 CPU cores, 20 GB disk
- Recommended: 8 GB RAM, 4 CPU cores, 50 GB disk
- Static local IP assigned via router DHCP reservation (e.g., `192.168.1.100`)

### Software on Home Server

```bash
# Install Docker Engine + Docker Compose v2
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out and back in after

# Verify
docker --version          # Docker Engine 24+
docker compose version    # Docker Compose v2.x
```

### Tools on Dev Machine (macOS)

```bash
brew install supabase/tap/supabase   # Supabase CLI (for key generation)
brew install postgresql              # psql client (for db migration)
```

### Credentials to Gather Before Starting

Pull these from Render's environment variables dashboard and your local files:

- [ ] Supabase Cloud project ref (Project Settings → General, e.g., `abcdefghijklmnop`)
- [ ] Supabase Cloud database password (Project Settings → Database)
- [ ] `RAILS_MASTER_KEY` — from `api/config/master.key`
- [ ] `SECRET_KEY_BASE` — from Render env vars
- [ ] `DEVISE_JWT_SECRET_KEY` — from Render env vars
- [ ] `RESEND_API_KEY` — from Render env vars
- [ ] `GOOGLE_CLIENT_ID` — from Render env vars
- [ ] Home server's static local IP address

---

## Phase 1: Self-Hosted Supabase

Self-hosted Supabase uses the official Docker Compose from the `supabase/supabase` repo. It runs PostgreSQL 15, Studio (web dashboard), Storage API (MinIO-backed), GoTrue auth, and more.

### 1.1 Clone the official repo on the home server

```bash
git clone --depth 1 https://github.com/supabase/supabase.git
cd supabase/docker
cp .env.example .env
```

### 1.2 Generate required secrets

```bash
# Run these on any machine with openssl
openssl rand -base64 32   # → POSTGRES_PASSWORD
openssl rand -base64 32   # → JWT_SECRET
openssl rand -base64 16   # → DASHBOARD_PASSWORD
```

### 1.3 Generate ANON_KEY and SERVICE_ROLE_KEY

These are JWTs signed with your `JWT_SECRET`. Use the Supabase CLI:

```bash
supabase gen keys --project-id local --jwt-secret <your-JWT_SECRET>
```

This outputs two values: paste `anon` → `ANON_KEY` and `service_role` → `SERVICE_ROLE_KEY` in `.env`.

### 1.4 Edit `supabase/docker/.env`

```dotenv
POSTGRES_PASSWORD=<generated>

JWT_SECRET=<generated>
ANON_KEY=<generated-anon-key>
SERVICE_ROLE_KEY=<generated-service-role-key>

DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<generated>

# Public hostname of your home server
SITE_URL=http://192.168.1.100:8000
API_EXTERNAL_URL=http://192.168.1.100:8000

# Supabase internal email (GoTrue) — point at Resend SMTP
SMTP_ADMIN_EMAIL=mjshaw90@gmail.com
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<your-resend-api-key>
SMTP_SENDER_NAME=CatCare
```

### 1.5 Start self-hosted Supabase

```bash
cd supabase/docker
docker compose up -d

# Verify all containers are healthy (takes 2-3 minutes on first boot)
docker compose ps
```

Expected running containers: `supabase-db`, `supabase-studio`, `supabase-kong`, `supabase-auth`, `supabase-rest`, `supabase-realtime`, `supabase-storage`, `supabase-imgproxy`, `supabase-meta`, `supabase-analytics`, `storage` (MinIO).

**Verify:** Open `http://192.168.1.100:8000` → Studio dashboard loads.

---

## Phase 2: Database Migration (Cloud → Self-Hosted)

This migrates all live data from your Supabase Cloud PostgreSQL instance to the self-hosted one.

### 2.1 Wake the cloud database

If your Supabase free tier project has paused, open the Supabase dashboard and click **Restore project**. Wait until it's active before continuing.

### 2.2 Dump from Supabase Cloud

Run from your dev machine. Use the **direct** connection string (not the pooler) for pg_dump:

```bash
# Connection string format: postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres

pg_dump \
  --no-acl \
  --no-owner \
  --schema=public \
  -Fc \
  -f catcare_cloud_$(date +%Y%m%d).dump \
  "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
```

The `-Fc` flag creates a compressed custom-format dump that `pg_restore` handles best.

### 2.3 Restore to self-hosted Supabase

```bash
pg_restore \
  --no-acl \
  --no-owner \
  -d "postgresql://postgres:<POSTGRES_PASSWORD>@192.168.1.100:5432/postgres" \
  catcare_cloud_$(date +%Y%m%d).dump
```

### 2.4 Verify the migration

```bash
# List all tables
psql "postgresql://postgres:<POSTGRES_PASSWORD>@192.168.1.100:5432/postgres" \
  -c "\dt public.*"

# Check row counts
psql "postgresql://postgres:<POSTGRES_PASSWORD>@192.168.1.100:5432/postgres" \
  -c "SELECT tablename, n_live_tup FROM pg_stat_user_tables ORDER BY tablename;"

# Verify Rails schema_migrations are present
psql "postgresql://postgres:<POSTGRES_PASSWORD>@192.168.1.100:5432/postgres" \
  -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 5;"
```

Compare row counts against Supabase Cloud Studio → Table Editor to confirm completeness.

### 2.5 Reset local login credentials

The migrated `encrypted_password` hashes (bcrypt) work locally exactly as they did in the cloud — nothing breaks them. This step exists purely for convenience: you likely don't know your users' real plaintext passwords, and password-reset emails won't reach real inboxes locally (Resend's shared sender domain only delivers to the account owner — see `NEXT_STEPS.md`).

Run this **after** Phase 4 (Rails API image built) so the app's environment/gems are available:

```bash
docker run --rm \
  --env-file ~/catcare/.env.api \
  -e LOCAL_PASSWORD=<pick-a-local-password> \
  catcare-api:latest \
  bundle exec rails catcare:local:reset_credentials
```

This sets every non-OAuth user to the same `LOCAL_PASSWORD`, clears any account locks, and leaves Google OAuth accounts untouched (they don't use a password). It prints the list of emails it reset — refuses to run if `RAILS_ENV=production`.

---

## Phase 3: Self-Hosted Redis

```bash
mkdir -p ~/catcare/redis-data

docker run -d \
  --name catcare-redis \
  --restart unless-stopped \
  -p 6379:6379 \
  -v ~/catcare/redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes

# Verify
docker exec catcare-redis redis-cli ping
# → PONG
```

---

## Phase 4: Rails API + Sidekiq

### 4.1 Build the Docker image

The repo already has a multi-stage `Dockerfile` in `api/`.

**Option A — Build directly on home server** (requires cloning the repo there):

```bash
cd /path/to/CatCare/api
docker build -t catcare-api:latest .
```

**Option B — Build on dev machine, transfer to home server:**

```bash
# On dev machine
cd "/Users/mattshaw/Documents/Software Development/CatCare/api"
docker build -t catcare-api:latest .
docker save catcare-api:latest | ssh user@192.168.1.100 docker load
```

### 4.2 Create the environment file

Create `~/catcare/.env.api` on the home server:

```dotenv
RAILS_ENV=production

# Copy these from Render env vars
SECRET_KEY_BASE=<from-render>
DEVISE_JWT_SECRET_KEY=<from-render>

# Copy from api/config/master.key
RAILS_MASTER_KEY=<master-key-value>

# Self-hosted Supabase PostgreSQL (direct connection, no pooler needed locally)
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@192.168.1.100:5432/postgres?schema_search_path=public

# Self-hosted Redis
REDIS_URL=redis://192.168.1.100:6379/0

# CORS — must match the frontend URL exactly
CORS_ORIGINS=http://192.168.1.100:5173

# Used by Rails mailer to generate links in emails
APP_HOST=192.168.1.100

# Email — Resend API key is unchanged (no hosting needed)
RESEND_API_KEY=<from-render>
MAILER_SENDER=noreply@yourdomain.com

# OAuth
GOOGLE_CLIENT_ID=<from-render>

# Admin — comma-separated, any listed email gets super admin on login
SUPER_ADMIN_EMAIL=mjshaw90@gmail.com

# Disable Sentry on self-hosted (optional)
SENTRY_DSN=

# Opt this deployment into name+password login with no email required
# (Rails.env is "production" here same as Render, so this can't be a
# Rails.env check — it has to be its own explicit flag). Must be paired
# with VITE_LOCAL_ACCOUNTS_ENABLED=true on the frontend build (Phase 6) —
# the two are independent flags read by different processes, so setting
# only one leaves the login form and the API disagreeing about which mode
# they're in. Leave both unset on Render.
LOCAL_ACCOUNTS_ENABLED=true
```

### 4.3 Run database migrations

```bash
docker run --rm \
  --env-file ~/catcare/.env.api \
  catcare-api:latest \
  bundle exec rails db:migrate
```

### 4.4 Verify the API

```bash
docker run -d \
  --name catcare-api \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file ~/catcare/.env.api \
  catcare-api:latest

curl http://192.168.1.100:3000/health
# → 200 OK
```

---

## Phase 5: Active Storage / Cat Photos

Cat photos on Render used the **local disk** storage service, which is ephemeral — files are wiped on every deploy. There are likely no photos to migrate.

**Confirm before proceeding:**

```bash
psql "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" \
  -c "SELECT COUNT(*) FROM active_storage_blobs;"
```

If the count is `0`, skip this phase.

**If photos exist** (Supabase Storage S3 was wired up at some point), the `config/storage.yml` `supabase` service is already configured. Point it at the local Supabase Storage by adding to `.env.api`:

```dotenv
SUPABASE_S3_KEY_ID=<ANON_KEY>
SUPABASE_S3_SECRET=<SERVICE_ROLE_KEY>
SUPABASE_S3_REGION=local
SUPABASE_S3_BUCKET=catcare-storage
SUPABASE_S3_ENDPOINT=http://192.168.1.100:8000/storage/v1/s3
```

Create the bucket in Studio → Storage → New Bucket → `catcare-storage`.

Then set `config.active_storage.service = :supabase` in `config/environments/production.rb` and rebuild the image.

---

## Phase 6: Frontend

### 6.1 Build on dev machine

```bash
cd "/Users/mattshaw/Documents/Software Development/CatCare/web"

# Create production env (Vite bakes these in at build time)
cat > .env.production << 'EOF'
VITE_API_URL=http://192.168.1.100:3000
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>
VITE_SENTRY_DSN=
# Only if LOCAL_ACCOUNTS_ENABLED=true is also set in .env.api (Phase 4.2) —
# leave unset/false otherwise:
VITE_LOCAL_ACCOUNTS_ENABLED=true
# Playful dashboard redesign preview — adds a ✨ classic/playful toggle in the nav:
VITE_PLAYFUL_UI_ENABLED=true
# Sidebar navigation preview — adds a panel-left classic/sidebar toggle in the nav:
VITE_SIDEBAR_NAV_ENABLED=true
EOF

npm run build
# Output: dist/
```

### 6.2 Copy build to home server

```bash
scp -r dist/ user@192.168.1.100:~/catcare/web-dist/
```

### 6.3 Create Nginx config

Create `~/catcare/nginx.conf` on the home server:

```nginx
server {
    listen 5173;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback — React Router handles all routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 6.4 Start Nginx

```bash
docker run -d \
  --name catcare-web \
  --restart unless-stopped \
  -p 5173:5173 \
  -v ~/catcare/web-dist:/usr/share/nginx/html:ro \
  -v ~/catcare/nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine
```

**Verify:** Open `http://192.168.1.100:5173` in a browser on the local network.

---

## Phase 7: Docker Compose — Full Stack

Manage all CatCare services (API, Sidekiq, Redis, web) with a single Compose file. Keep this separate from the Supabase Compose file.

Create `~/catcare/docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  api:
    image: catcare-api:latest
    restart: unless-stopped
    env_file: .env.api
    ports:
      - "3000:3000"
    depends_on:
      - redis

  sidekiq:
    image: catcare-api:latest
    restart: unless-stopped
    env_file: .env.api
    command: bundle exec sidekiq -C config/sidekiq.yml
    depends_on:
      - redis

  web:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "5173:5173"
    volumes:
      - ./web-dist:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro

volumes:
  redis_data:
```

**Common commands:**

```bash
cd ~/catcare
docker compose up -d              # start everything
docker compose logs -f api        # tail API logs
docker compose logs -f sidekiq    # tail Sidekiq/reminder logs
docker compose down               # stop everything
docker compose up -d --force-recreate api sidekiq   # restart after image update
```

---

## Phase 8: Environment Variable Reference

### Rails API (`.env.api`)

| Variable | Value |
|---|---|
| `RAILS_ENV` | `production` |
| `SECRET_KEY_BASE` | Copy from Render |
| `RAILS_MASTER_KEY` | From `api/config/master.key` |
| `DATABASE_URL` | `postgresql://postgres:<PW>@192.168.1.100:5432/postgres?schema_search_path=public` |
| `REDIS_URL` | `redis://192.168.1.100:6379/0` |
| `DEVISE_JWT_SECRET_KEY` | Copy from Render |
| `CORS_ORIGINS` | `http://192.168.1.100:5173` |
| `APP_HOST` | `192.168.1.100` |
| `RESEND_API_KEY` | Copy from Render (unchanged) |
| `MAILER_SENDER` | Copy from Render |
| `GOOGLE_CLIENT_ID` | Copy from Render (unchanged) |
| `SUPER_ADMIN_EMAIL` | `mjshaw90@gmail.com` (comma-separated for multiple) |
| `LOCAL_ACCOUNTS_ENABLED` | `true` to allow name+password login with no email (self-hosted only — never set on Render); pair with `VITE_LOCAL_ACCOUNTS_ENABLED` below |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push keys (generate once with `WebPush.generate_key`; keep stable). Optional `VAPID_SUBJECT` (`mailto:`). Unset = push disabled |
| `FORCE_SSL` | `false` on the LAN (TLS is terminated by Caddy; the API itself is plain HTTP) |

### Frontend (`.env.production` — baked into build)

| Variable | Value |
|---|---|
| `VITE_API_URL` | `http://192.168.1.100:3000` |
| `VITE_GOOGLE_CLIENT_ID` | Same as before |
| `VITE_SENTRY_DSN` | Leave empty |
| `VITE_LOCAL_ACCOUNTS_ENABLED` | `true` only if `LOCAL_ACCOUNTS_ENABLED=true` is also set in `.env.api` above |
| `VITE_PLAYFUL_UI_ENABLED` | `true` to build in the playful dashboard redesign preview; users flip classic ↔ playful with the ✨ nav button (per device). Frontend-only — no API counterpart |
| `VITE_HTTPS_URL` | `https://192.168.20.20:8443` — address of the Caddy HTTPS front; only used to show the "set up this device" help on the HTTP site |
| `VITE_SIDEBAR_NAV_ENABLED` | `true` to build in the left-sidebar navigation preview (collapsible on desktop, bottom pill on mobile); the sidebar is the default and users can switch to the classic top bar with the panel-left nav button (per device). Frontend-only — no API counterpart |

---

## Phase 9: Networking

### LAN-only (default)
No configuration needed beyond what's above. Access the app at `http://192.168.1.100:5173` from any device on your home network.

### Remote access from outside home network

**Option A: Tailscale (recommended)**

Tailscale creates a secure overlay network. No port forwarding, no DynDNS, automatic HTTPS via MagicDNS.

```bash
# On home server
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

After setup, use your Tailscale IP (e.g., `100.x.x.x`) instead of `192.168.1.100` everywhere — in `.env.api`, `CORS_ORIGINS`, and the frontend `.env.production` before rebuilding.

**Option B: Cloudflare Tunnel**

Free encrypted tunnel, no open router ports required:

```bash
cloudflared tunnel create catcare
cloudflared tunnel route dns catcare catcare.yourdomain.com
```

**Option C: Router port forwarding + DynDNS**

Forward ports `3000` and `5173` on your router to `192.168.1.100`. Use DuckDNS or No-IP for a stable hostname.

---

## Phase 10: SSL / HTTPS (Optional)

Tailscale MagicDNS handles SSL automatically. For a custom domain, use Caddy as a reverse proxy — it auto-provisions Let's Encrypt certificates.

Add to `docker-compose.yml`:

```yaml
  caddy:
    image: caddy:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data

volumes:
  redis_data:
  caddy_data:
```

Create `~/catcare/Caddyfile`:

```caddyfile
catcare.yourdomain.com {
    reverse_proxy web:5173
}

api.catcare.yourdomain.com {
    reverse_proxy api:3000
}
```

Update `CORS_ORIGINS` in `.env.api` and rebuild the frontend with the new `VITE_API_URL` pointing at `https://api.catcare.yourdomain.com`.

---

## Phase 11: Cutover Procedure

Execute in this exact order to minimize data loss:

1. **Freeze cloud writes** — Stop Render app (Dashboard → Manual Deploy → toggle off, or set environment to maintenance mode)
2. **Final database dump** — Run the `pg_dump` command from Phase 2.2 one final time
3. **Restore final dump** — Run `pg_restore` from Phase 2.3
4. **Update Google OAuth** — In Google Cloud Console → APIs & Services → Credentials → your OAuth Client:
   - Add `http://192.168.1.100:5173` to **Authorized JavaScript Origins**
   - Add `http://192.168.1.100:5173` to **Authorized Redirect URIs**
5. **Rebuild frontend** with new `VITE_API_URL` pointing at home server
6. **Verify health** — `curl http://192.168.1.100:3000/health`
7. **Test end-to-end** — See verification checklist below
8. **Shut down cloud services** — Delete Render service, pause/delete Supabase project (after keeping a final backup)

---

## Phase 12: Verification Checklist

| Check | Command / Action |
|---|---|
| Supabase Studio | Open `http://192.168.1.100:8000`, verify tables and row counts |
| API health | `curl http://192.168.1.100:3000/health` → 200 |
| Frontend loads | Open `http://192.168.1.100:5173` |
| Email/password login | Log in with existing account |
| Google OAuth login | Log in with Google |
| Care event creation | Add a care event, verify it appears on dashboard |
| Reminders | Create a reminder, check `docker compose logs -f sidekiq` for processing |
| Email delivery | Trigger a reminder, verify email arrives (Resend unchanged) |
| Redis | `docker exec catcare-redis redis-cli info keyspace` |
| Sidekiq queues | `docker exec catcare-redis redis-cli llen sidekiq:queue:reminders` |

---

## Ongoing Maintenance

### Deploy API changes

```bash
# 1. Build new image on dev machine
cd "/Users/mattshaw/Documents/Software Development/CatCare/api"
docker build -t catcare-api:latest .

# 2. Transfer to home server
docker save catcare-api:latest | ssh user@192.168.1.100 docker load

# 3. Restart containers on home server
cd ~/catcare
docker compose up -d --force-recreate api sidekiq

# 4. Run migrations if schema changed
docker compose exec api bundle exec rails db:migrate
```

### Deploy frontend changes

```bash
# 1. Build on dev machine
cd "/Users/mattshaw/Documents/Software Development/CatCare/web"
npm run build

# 2. Copy to server (Nginx picks up changes immediately — no restart needed)
scp -r dist/ user@192.168.1.100:~/catcare/web-dist/
```

### Update self-hosted Supabase

```bash
cd ~/supabase/docker
git pull
docker compose pull
docker compose up -d
```

### Automated database backups

Add to crontab on the home server (`crontab -e`):

```cron
# Daily backup at 2:00 AM, retain 30 days
0 2 * * * docker exec supabase-db pg_dump -U postgres postgres | gzip > ~/catcare/backups/db_$(date +\%Y\%m\%d).sql.gz
@daily find ~/catcare/backups/ -name "*.sql.gz" -mtime +30 -delete
```

Create the backups directory first: `mkdir -p ~/catcare/backups`

### Restore from a backup

```bash
gunzip -c ~/catcare/backups/db_20260605.sql.gz | \
  psql "postgresql://postgres:<POSTGRES_PASSWORD>@192.168.1.100:5432/postgres"
```

### Syncing Supabase Cloud data into the Proxmox LXC path

For the `proxmox-homelab` deployment specifically (see the note at the
top of this file), a local `db-pull.sh` script at this repo's root
automates the Phase 2 pg_dump/restore end-to-end: streams a dump
straight from Supabase Cloud into the LXC's `postgres` container over
SSH (no dump file ever touches disk on either end), reads the Supabase
connection string from macOS Keychain rather than a file, and keeps
`pg_dump`'s version matched to the target server to avoid the
cross-version `SET` command failures Phase 2 warns about. It's
intentionally **not** committed to this repo (gitignored) since it
hardcodes real LXC infrastructure details (IP, SSH user, key path,
container names) and this repo is public — see the script's own header
comments for usage, or `proxmox-homelab/README.md`'s CatCare section
for the fuller picture (Postgres version-matching, multi-admin support,
Google OAuth via nip.io, adding local users).
