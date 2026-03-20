# CatCare — Deployment Guide

Production deployment for 2-person household beta testing. All services are free tier.

---

## Services at a Glance

| Purpose | Service | URL |
|---|---|---|
| API hosting | Render.com | render.com |
| Database (PostgreSQL) | Supabase | supabase.com |
| Redis (background jobs) | Upstash | upstash.com |
| File storage (cat photos) | Cloudinary | cloudinary.com |
| Email delivery | Gmail SMTP (App Password) | myaccount.google.com |
| Frontend hosting | Vercel | vercel.com |

---

## Step 1 — Create External Service Accounts

### A. Cloudinary (file storage)
1. Sign up free at cloudinary.com — no credit card required
2. Dashboard → copy the **`CLOUDINARY_URL`**
   - Format: `cloudinary://api_key:api_secret@cloud_name`
   - This single env var is all that's needed — no other config

### B. Gmail App Password (email delivery)
1. myaccount.google.com → Security
2. Enable **2-Step Verification** (required before App Passwords work)
3. Security → **App passwords** → Select app: "Mail" → Generate
4. Copy the 16-character password — it is shown only once

> Gmail sends up to 500 emails/day. More than enough for 2-person testing.

### C. Supabase (PostgreSQL database)
1. Sign up free at supabase.com — no credit card, no 90-day expiry
2. New project → choose a region closest to you
3. Settings → Database → **Connection string** → select **Transaction** mode
   - Format: `postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:6543/postgres`
> Do NOT use Render's free PostgreSQL — it is deleted after 90 days.

### D. Upstash (Redis for Sidekiq)
1. Sign up free at upstash.com — no credit card, no expiry
2. Create database → Redis → same region as Supabase
3. Database details page → copy the **Redis URL**
   - Format: `rediss://...`

---

## Step 2 — Code is Already Configured

The following production config changes are committed to the repo:

| File | What was configured |
|---|---|
| `api/config/environments/production.rb` | SSL, Cloudinary storage, Gmail SMTP, Sidekiq, Redis cache, host authorization |
| `api/config/storage.yml` | Cloudinary service block added |
| `api/Gemfile` | `gem "cloudinary"` added |
| `api/config/initializers/devise.rb` | Mailer sender reads `MAILER_SENDER` env var |
| `api/app/mailers/application_mailer.rb` | `from` reads `MAILER_SENDER` env var |
| `api/Procfile` | Defines `web` (Puma) and `worker` (Sidekiq) processes |

---

## Step 3 — Deploy Rails API to Render.com

1. render.com → New → **Web Service**
   - Connect your GitHub repo
   - Root directory: `api`
   - Build command: `bundle install && bundle exec rails db:migrate`
   - Start command: `bundle exec puma -C config/puma.rb`
   - Instance type: **Free**

2. render.com → New → **Background Worker** (second service)
   - Same GitHub repo, same root directory `api`
   - Start command: `bundle exec sidekiq -q default -q mailers`
   - Apply the same environment variables as the web service

3. Set these **environment variables** on **both** services:

   | Variable | Value / Source |
   |---|---|
   | `RAILS_ENV` | `production` |
   | `SECRET_KEY_BASE` | Run `openssl rand -hex 64` in your terminal |
   | `RAILS_MASTER_KEY` | Contents of `api/config/master.key` (see note below) |
   | `DATABASE_URL` | Supabase connection string (Step 1C) |
   | `REDIS_URL` | Upstash Redis URL (Step 1D) |
   | `DEVISE_JWT_SECRET_KEY` | Run `openssl rand -hex 64` in your terminal (different value from SECRET_KEY_BASE) |
   | `APP_HOST` | e.g. `catcare-api.onrender.com` (your Render service name) |
   | `CORS_ORIGINS` | e.g. `https://catcare.vercel.app` (set after Step 4) |
   | `CLOUDINARY_URL` | From Cloudinary dashboard (Step 1A) |
   | `GMAIL_USERNAME` | Your Gmail address (e.g. `you@gmail.com`) |
   | `GMAIL_APP_PASSWORD` | 16-character app password (Step 1B) |
   | `MAILER_SENDER` | Same as `GMAIL_USERNAME` |

   **How to generate random secrets** (run in any terminal):
   ```bash
   openssl rand -hex 64
   ```
   Run it twice — use one value for `SECRET_KEY_BASE` and a different value for `DEVISE_JWT_SECRET_KEY`.

   **Finding `master.key`**: Open `api/config/master.key` in a text editor. Copy the single line of text and paste it as the value of `RAILS_MASTER_KEY`. Never commit this file to git.

---

## Step 4 — Deploy Frontend to Vercel

1. vercel.com → New Project → Import from GitHub
   - Root directory: `web`
   - Build command: `npm run build` (auto-detected)
   - Output directory: `dist`

2. Add environment variable:
   ```
   VITE_API_URL=https://<your-render-service>.onrender.com
   ```

3. Deploy → copy the Vercel production URL

4. Go back to Render → update `CORS_ORIGINS` on both services to the exact Vercel URL → trigger a redeploy

---

## Step 5 — Smoke Test

Walk through these flows to confirm the deployment is working:

- [ ] Open the Vercel URL → register your account
- [ ] Create a household → add your cat(s)
- [ ] Invite your partner via the invite form → partner clicks the email link → registers
- [ ] Partner logs a care event → verify it appears on your dashboard
- [ ] Upload a cat photo → refresh the page → verify it still shows (confirms Cloudinary is working)
- [ ] Open on a phone → verify the layout is usable on mobile
- [ ] Toggle dark mode → verify it persists on refresh

---

## Important Notes

**Render free tier spin-down**: The free web service sleeps after 15 minutes of inactivity. The first request after sleeping takes ~30 seconds. This is fine for testing. Upgrade to Render Starter ($7/month) if the wake-up delay is annoying.

**`master.key` is not in git**: You must paste its contents as `RAILS_MASTER_KEY` in Render manually every time you create a new service. Keep a copy somewhere safe (password manager).

**CORS order of operations**: You will not know the Vercel URL until after Step 4. During Step 3, set `CORS_ORIGINS` to a placeholder. After Step 4, update it to the real URL and redeploy both Render services.

**Supabase connection mode**: Use **Transaction** mode (port 6543) for the connection string, not Session mode. Render's Puma server uses a connection pool that works correctly with transaction mode.

**Gmail limit**: 500 emails/day on a personal Gmail account. More than enough for 2 users. If you want emails to come from a custom domain address in the future, switch to SendGrid (free up to 100 emails/day).

**Cloudinary free tier**: 25 GB storage + 25 GB bandwidth/month. At typical cat photo sizes (~500KB), this supports roughly 50,000 photos before hitting the limit.

---

## Future: Upgrading Beyond Free Tier

When ready to go beyond 2-person testing:

| Component | Upgrade path |
|---|---|
| API | Render Starter ($7/mo) — always-on, no spin-down |
| Database | Supabase Pro ($25/mo) or keep free (500MB is generous) |
| Redis | Upstash Pay-as-you-go (fractions of a cent per request) |
| Email | SendGrid (free 100/day; Essentials $19.95/mo for 50k/mo) |
| Storage | Cloudinary paid ($89/mo at next tier; free covers ~50k photos) |
| Frontend | Vercel free tier scales well for personal use |
