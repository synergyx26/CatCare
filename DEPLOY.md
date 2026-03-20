# CatCare — Deployment Guide

Production deployment for 2-person household beta testing. All services are free tier.

**Last verified working:** March 2026

---

## Production Stack

| Purpose | Service | URL |
|---|---|---|
| API hosting | Render.com | render.com |
| Database (PostgreSQL) | Supabase | supabase.com |
| Redis (background jobs + cache) | Upstash | upstash.com |
| Email delivery | Gmail SMTP (App Password) | myaccount.google.com |
| Frontend hosting | Vercel | vercel.com |

> **File storage note:** The `cloudinary` gem v2.x is incompatible with Rails 8.1 + Ruby 4.0 and has been removed. Cat photos use local Render disk storage for now. Photos will not persist across Render deploys — this is acceptable for beta testing. See NEXT_STEPS.md for the fix.

---

## Step 1 — Create External Service Accounts

### A. Supabase (PostgreSQL database)
1. Sign up free at supabase.com — no credit card, no expiry
2. New project → choose a region closest to you
3. Settings → Database → **Connection Pooling** → select **Session** mode
   - Format: `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`
   - Use the **Copy** button — do not type this manually

> **Critical:** Use **Session** mode (port 5432 through the pooler), NOT Transaction mode and NOT the direct connection.
> - Direct connection resolves to an IPv6 address that Render's free tier cannot reach
> - Transaction mode (pgBouncer, port 6543) breaks Rails advisory locks used during migrations
> - Session mode is IPv4, supports persistent connections, and works correctly with Rails

### B. Upstash (Redis for Sidekiq + cache)
1. Sign up free at upstash.com — no credit card, no expiry
2. Create database → Redis → same region as Supabase
3. Database details page → copy the **Redis URL**
   - Format: `rediss://default:PASSWORD@hostname:port`
   - Use the **Copy** button — the URL contains a password that may not display fully on screen

### C. Gmail App Password (email delivery)
1. myaccount.google.com → Security
2. Enable **2-Step Verification** (required before App Passwords work)
3. Security → **App passwords** → Select app: "Mail" → Generate
4. Copy the 16-character password — shown only once, no spaces

> Gmail sends up to 500 emails/day — more than enough for beta testing.

---

## Step 2 — Deploy Rails API to Render.com

1. render.com → New → **Web Service**
   - Connect GitHub repo: `synergyx26/CatCare`
   - Root directory: `api`
   - Build command: `bundle install`
   - Start command: *(leave blank — the Procfile handles it)*
   - Instance type: **Free**

2. Set these **environment variables** on the web service:

   | Variable | Value |
   |---|---|
   | `RAILS_ENV` | `production` |
   | `SECRET_KEY_BASE` | `openssl rand -hex 64` |
   | `RAILS_MASTER_KEY` | Contents of `api/config/master.key` |
   | `DATABASE_URL` | Supabase Session pooler URL (Step 1A) |
   | `REDIS_URL` | Upstash Redis URL (Step 1B) |
   | `DEVISE_JWT_SECRET_KEY` | `openssl rand -hex 64` (different value from SECRET_KEY_BASE) |
   | `APP_HOST` | e.g. `catcare-v52y.onrender.com` |
   | `CORS_ORIGINS` | Your Vercel URL (set after Step 3) |
   | `GMAIL_USERNAME` | Your full Gmail address (e.g. `you@gmail.com`) |
   | `GMAIL_APP_PASSWORD` | 16-character app password, no spaces (Step 1C) |

   **Generating secrets:**
   ```bash
   openssl rand -hex 64
   ```
   Run twice — use different values for `SECRET_KEY_BASE` and `DEVISE_JWT_SECRET_KEY`.

   **Finding master.key:** Open `api/config/master.key` — copy the single line of text. Never commit this file to git.

3. Deploy → wait for `==> Migrations complete.` in logs, then `Your service is live`

---

## Step 3 — Deploy Frontend to Vercel

1. vercel.com → New Project → Import from GitHub
   - Root directory: `web`
   - Framework: Vite (auto-detected)
   - Build command: `npm run build`
   - Output directory: `dist`

2. Add environment variable **before** deploying:
   ```
   VITE_API_URL = https://<your-render-service>.onrender.com
   ```
   > This is a build-time variable — Vercel must rebuild after any change to it.

3. Deploy → copy the production Vercel URL

4. Go back to Render → update `CORS_ORIGINS` to the exact Vercel URL → Save (triggers redeploy)

---

## Step 4 — Verify Deployment

```
GET https://<render-url>/health
→ {"status":"ok","db":"connected"}
```

Then walk through the smoke test:

- [ ] Open the Vercel URL → register your account
- [ ] Complete household setup → add your cat(s)
- [ ] Invite household member → they accept and register
- [ ] Log a care event → verify it appears on dashboard
- [ ] Toggle dark mode → verify it persists on refresh
- [ ] Open on mobile → verify layout is usable

---

## How Migrations Work

Migrations run automatically on every deploy via `api/bin/render-start`:

```bash
bundle exec rails db:migrate   # runs all pending migrations
exec bundle exec puma -C config/puma.rb  # starts server regardless
```

Render does not use the Docker entrypoint — it reads the Procfile (`web: bin/render-start`).

---

## Important Notes

**Render free tier spin-down:** The service sleeps after 15 minutes of inactivity. First request after sleeping takes ~30 seconds. Acceptable for beta. Upgrade to Render Starter ($7/mo) when this becomes annoying.

**Supabase free tier pausing:** Supabase pauses projects after 1 week of inactivity. Visit the Supabase dashboard to wake a paused project before testing.

**`master.key` is not in git:** Paste its contents as `RAILS_MASTER_KEY` in Render manually. Keep a copy in your password manager.

**Cat photos don't persist across deploys:** Render's free disk is ephemeral. Each deploy wipes uploaded files. For beta with 2 users this is tolerable. See NEXT_STEPS.md for the permanent fix.

---

## Future: Upgrading Beyond Free Tier

| Component | Upgrade path |
|---|---|
| API | Render Starter ($7/mo) — always-on, no spin-down |
| Database | Supabase Pro ($25/mo) or keep free (500MB limit) |
| Redis | Upstash Pay-as-you-go (fractions of a cent per request) |
| Email | SendGrid (free 100/day; Essentials $19.95/mo for 50k/mo) |
| File storage | Re-add Cloudinary once gem supports Rails 8.1 (see NEXT_STEPS.md) |
| Frontend | Vercel free tier scales well for personal use |
