# CatCare — Next Steps & Enhancement Log

**Current status:** MVP deployed and functional. Beta testing with 2-person household.

---

## MVP Gaps (must fix before wider testing)

### 1. Email Reminders — Not Built
**What's missing:** The `Reminder` and `ReminderRecipient` models and database tables exist, and the reminders API routes are wired up, but the Sidekiq job that actually sends reminder emails has never been built.

**What needs to be done:**
- Create `app/jobs/reminder_job.rb` — loads due reminders, sends email via `UserMailer`, updates `next_trigger_at`
- Create `app/mailers/reminder_mailer.rb` with a care reminder email template
- Register the job in `config/sidekiq_cron.yml` (or schedule dynamically when a reminder is saved)
- Wire the Reminder create/destroy API to schedule/cancel the Sidekiq job
- The Render worker dyno (`worker: bundle exec sidekiq`) is already configured — just needs the job

**Note:** The Render free tier only runs one process type. The `worker` process in the Procfile requires a separate paid Background Worker service on Render, or the job can be enqueued and processed in-process using `config.active_job.queue_adapter = :async` for beta.

---

### 2. Persistent File Storage for Cat Photos
**What's missing:** Cat photos upload correctly but are stored on Render's ephemeral disk. Every deploy wipes all uploaded photos.

**What needs to be done:**
- Wait for `cloudinary` gem to ship Rails 8.1 + Ruby 4.0 compatibility (track: https://github.com/cloudinary/cloudinary_gem)
- OR switch to Supabase Storage (S3-compatible, free tier is generous)

**Supabase Storage approach (recommended short-term):**
- Add `gem "aws-sdk-s3"` to Gemfile
- In `config/storage.yml`, add an S3 service block pointing to Supabase Storage endpoint
- Set `config.active_storage.service = :supabase_storage` in production.rb
- Add `SUPABASE_STORAGE_*` env vars to Render

---

### 3. Password Reset Email Flow
**What's built:** The `PasswordsController` API and `UserMailer#reset_password_instructions` template exist. The Gmail SMTP config is live.

**What to verify:** End-to-end test — request password reset → email arrives → link works → password updates successfully.

---

## OAuth / Social Login

### Architecture: Frontend-Initiated Token Exchange (no OmniAuth redirect flow)
Because CatCare is an API-only Rails app with a React SPA, the traditional OmniAuth redirect + cookie flow is impractical. Use the frontend-initiated pattern instead:

1. React launches the OAuth consent popup (Google JS SDK / `@react-oauth/google`)
2. Provider returns an ID token directly to the React client
3. React POSTs the token to `POST /api/v1/auth/google`
4. Rails verifies the token against Google's public endpoint and finds-or-creates the User
5. Rails issues a CatCare JWT — identical response contract to email login
6. React stores the JWT in `authStore` — no change to downstream code

No new OmniAuth gems required. No callback URL complexity.

### Implementation Steps

**A — Database Migration**
- Add `provider` (string, nullable) and `uid` (string, nullable) to `users` table
- Add unique index on `[provider, uid]`
- Make Devise password validations conditional (skip for OAuth users who have no password)
- Add `oauth_user?` helper to `User` model

**B — Rails API (`api/`)**
- Create `app/controllers/api/v1/oauth_controller.rb`
  - `POST /api/v1/auth/google` — accepts `{ credential: "<google_id_token>" }`, verifies via `https://oauth2.googleapis.com/tokeninfo?id_token=<token>`, validates `aud` claim matches `GOOGLE_CLIENT_ID`, finds or creates User, returns JWT
- Add route: `post "auth/google", to: "oauth#google"`
- Add `GOOGLE_CLIENT_ID` to env vars (Render + `api/.env`)

**C — Account Linking Edge Cases**
- If Google email matches an existing email/password user → link accounts (set `provider`/`uid` on that row, don't create duplicate)
- If an OAuth user requests a password reset → return `OAUTH_USER` error: "You signed in with Google — password reset is not available"

**D — React Frontend (`web/`)**
- Install `@react-oauth/google`
- Wrap `<App>` in `<GoogleOAuthProvider clientId={VITE_GOOGLE_CLIENT_ID}>` in `main.tsx`
- Add `<GoogleLogin>` button to `LoginPage.tsx` and `RegisterPage.tsx`
- On OAuth success: POST credential to `/api/v1/auth/google` → store JWT + user in `authStore` → redirect to dashboard (same flow as email login)
- Add `VITE_GOOGLE_CLIENT_ID` to `.env.local` and Vercel env vars

**E — Google Cloud Console Setup**
- Create a new OAuth 2.0 Web Client ID at console.cloud.google.com
- Authorized JavaScript origins: `http://localhost:5173`, `https://<your-vercel-domain>`
- No Redirect URIs needed (frontend-initiated flow — no server-side callback)
- Set the Client ID as `GOOGLE_CLIENT_ID` (Rails) and `VITE_GOOGLE_CLIENT_ID` (React)

### Future Providers (same pattern)
- **GitHub**: exchange code for access token server-side via `POST https://github.com/login/oauth/access_token`, then fetch `GET https://api.github.com/user` for profile
- **Apple Sign In**: more complex — requires Apple Developer account + JWKS verification; defer until there's user demand

### Smoke Test Additions
- [ ] "Sign in with Google" on login page → lands on dashboard
- [ ] First-time Google sign-in creates account + household setup flow triggers
- [ ] Google sign-in with email matching existing account → links, does not duplicate
- [ ] OAuth user visits "forgot password" → receives helpful error, not a crash

---

## Phase 2 Features (from product plan)

### Medication Tracking
Add `medication` care event type (already in enum as type 5) with adherence log view. The `details` JSONB already stores `{ medication_name, dosage, unit }`. What's missing is a dedicated UI for viewing medication history and flagging missed doses.

### Reminder Smart Suppression
Don't send a feeding reminder if the cat was already fed today. Requires the reminder job to check `care_events` before sending.

### Vet Contact Management
The `vet_name`, `vet_clinic`, `vet_phone` fields already exist on the `Cat` model and are editable in `EditCatPage`. What's missing: display these prominently on `CatProfilePage` with a tap-to-call link on mobile.

### Improved Onboarding
The `OnboardingStepper` component exists. Review the flow for new users who arrive via an invite link vs. creating a fresh household — ensure neither path has dead ends.

---

## Phase 3 Features (future expansion)

### Native Mobile App
React Native with Expo. The Rails API is already mobile-ready — all endpoints return JSON, JWT auth works from any client. Priority: iOS first.

### Push Notifications
APNs (iOS) / FCM (Android) via Expo Notifications. Replace or supplement email reminders. The `Reminder` model already has the scheduling infrastructure.

### Vaccination Tracking
New model: `Vaccination` (cat_id, vaccine_name, administered_at, expires_at). Expiration reminders via the existing Sidekiq reminder infrastructure.

### Calendar View
Monthly calendar showing care events as dots/badges per day. Useful for spotting gaps in care. Built on the existing `/stats` endpoint data.

### PDF Export for Vet Visits
Export a cat's care history (last 90 days) as a formatted PDF. Useful for vet appointments. Rails: `prawn` gem or `wicked_pdf`.

### Multi-Species Support
The `Cat` model has a `species` enum — the infrastructure is partially there. Needs: species-specific care types, UI labeling changes, species-specific default reminder templates.

---

## Technical Debt

### Cloudinary Re-integration
The `cloudinary` gem v2.x is incompatible with Rails 8.1 + Ruby 4.0. Monitor [the gem's releases](https://github.com/cloudinary/cloudinary_gem/releases). When a compatible version ships:
1. Add `gem "cloudinary"` back to Gemfile
2. Set `config.active_storage.service = :cloudinary` in production.rb
3. Add `CLOUDINARY_URL` env var to Render

### HouseholdMembership Policy Specs
Per `CLAUDE.md`: `household_membership_policy.rb` exists but has no spec yet. Any changes to membership authorization logic are unverified. Add `spec/policies/household_membership_policy_spec.rb`.

### Render Free Tier Spin-Down
The API sleeps after 15 minutes of inactivity. First-request latency after sleep is ~30 seconds, which breaks the UX for returning users. Fix: upgrade to Render Starter ($7/mo) when the app has regular users.

### Supabase Free Tier Pausing
Supabase pauses projects after 1 week of no activity. This causes connection failures until the project is manually unpaused. Fix: add a lightweight cron job (e.g. GitHub Actions on a schedule) that pings `/health` every 3 days to keep the project active. Or upgrade to Supabase Pro ($25/mo).

---

## Smoke Test Checklist (run after each deploy)

- [ ] `GET /health` → `{"status":"ok","db":"connected"}`
- [ ] Register new account
- [ ] Create household + add cat
- [ ] Log all 8 care event types (feeding, litter, water, weight, note, medication, vet_visit, grooming)
- [ ] Edit and delete a care event
- [ ] Upload cat photo
- [ ] Invite a second user → they accept → both see shared dashboard
- [ ] View cat history page → all 5 charts render with data
- [ ] Archive a cat → verify it's hidden from dashboard
- [ ] Toggle dark mode → persists on refresh
- [ ] Test on mobile viewport (375px)
