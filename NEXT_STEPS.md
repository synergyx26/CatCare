# CatCare — Next Steps & Enhancement Log

**Current status:** MVP deployed and functional. Beta testing with 2-person household.

---

## Recently Completed

### Session State & Auth Reliability ✅ *(2026-03-27)*
- **Axios timeout (20s)**: API requests no longer hang indefinitely on Render cold starts — fail fast with an error instead of infinite loading skeletons
- **Proper 401 cleanup**: the 401 interceptor now calls `clearAuth()` instead of only removing `catcare_token`; previously `isAuthenticated: true` survived in localStorage after token expiry, leaving the app in a dirty auth state that required closing all browser windows to recover
- **Query cache cleared on login**: `queryClient.clear()` called on every successful login (email + Google OAuth) so stale entries from a prior session never produce an empty dashboard on re-login

---

### Care Settings & Feeding Portion Presets ✅ *(2026-03-26 — branch: feat/dashboard-enhancements)*
- **Care requirements per cat**: `feedings_per_day` (1–5), `track_water`, `track_litter` columns added to cats table; dashboard badges and "needs attention" count respect per-cat settings
- **Feeding portion presets**: `feeding_presets` JSONB column on cats; admins set custom gram presets per food type (wet, dry) in Care Settings — these appear as quick-pick buttons in the feeding log
- **Care Settings page** (`/households/:id/settings`, admin-only): per-cat cards with daily tracking toggles and portion preset editor (add/remove gram values, optimistic updates with rollback)
- **dotenv-rails moved to dev+test group**: RSpec now correctly loads `api/.env` so all 81 specs pass in test env

### Care History Chart Improvements ✅ *(2026-03-26 — branch: feat/dashboard-enhancements)*
- `CareTypeBreakdownChart`: replaced donut (WCAG grade C) with horizontal bar chart sorted descending, event colours preserved, LabelList value labels — now WCAG AAA
- `WeightTrendChart`: upgraded from LineChart to AreaChart with green gradient fill; fixed Y-axis spacing
- `FeedingFrequencyChart`: fixed XAxis font size (was below WCAG floor); tightened left margin
- `MemberContributionChart`: added LabelList labels; changed fill to `#a78bfa` (purple accent)
- `CareActivityHeatmap`: fixed dark mode contrast (sky-500 rgba ramp); unambiguous 2-char weekday labels
- `ChartCard`: wider accent stripe; higher drag handle opacity; aria-label on drag handle
- `CatHistoryPage`: StatCard label bumped from 10px to 11px; stale overlay uses animate-pulse

### Google OAuth (Sign in with Google) ✅ *(2026-03-26 — branch: feat/dashboard-enhancements)*
- `OauthController` verifies ID token against `https://oauth2.googleapis.com/tokeninfo` (no JWKS/Redis complexity); validates `aud` claim, finds-or-creates user, returns CatCare JWT
- Fixed JWKS Redis serialization bug (was caching JWK::Set object, not raw JSON string)
- Fixed Devise `DisabledSessionError` on 401 in API-only mode
- `GoogleOAuthButton` component on login/register pages; `@react-oauth/google` installed
- Smoke tests: sign-in with Google → dashboard; duplicate email → account linking (no duplicate user)

### Vet Address + Household Vet Section ✅ *(2026-03-26 — branch: feat/dashboard-enhancements)*
- `vet_address` column added to cats; editable in `EditCatPage`
- `HouseholdVetSection` component on `DashboardPage` — shared vet contact info for the household
- `UpcomingAppointmentsSection` — tracks scheduled vet/grooming appointments from future-dated care events
- Phone input component (`components/ui/phone-input.tsx`) used in membership profile

### Dashboard UX Enhancements ✅ *(2026-03-26 — branch: feat/dashboard-enhancements)*
- **Batch logging** (`BatchActionModal`): log the same event for multiple cats in one action
- **Care log date navigation**: browse past days in `TodayCareLog`; scroll back through history
- **Dark mode fixes**: dropdowns, member role change UI, resize placeholder all corrected
- **Dashboard greeting**: time-aware greeting with inline attention count replaces generic `PageHeader`

### Landing Page & Dashboard UI/UX Redesign ✅ *(2026-03-26 — branch: feat/dashboard-enhancements)*
- **Landing page hero**: Replaced cat photo with a live `AppDashboardMockup` component showing the real dashboard UI (cat cards, status chips, activity log)
- **Landing page analytics section**: Replaced Norwegian Forest Cat photo with `AnalyticsMockup` (weight trend SVG chart, feeding bar chart, care type donut, activity heatmap)
- **Landing page typography**: Fraunces display serif loaded dynamically for headings; warm off-white (`#faf8f5`) section backgrounds
- **How it Works**: Center-aligned step content, fixed connector line math, family/couple-focused copy (removed "team" language)
- **Dashboard greeting**: Replaced generic `PageHeader` + separate amber alert banner with a time-aware greeting ("Good morning, Sarah 👋") and inline attention count
- **CatCard**: Removed top accent bar; added "All caught up" / "Needs feeding" status line in emerald/amber; avatar now amber when all-good, orange when needing attention
- **CatStatusBadges**: Replaced verbose text badges with compact emoji chips (🍽️ Fed, 💧 Water, 🧹 Litter) — colored when done, muted when pending
- **TodayCareLog**: Emoji-based event rows with bold `"Feeding · Luna · 60g"` + muted `"Sarah · 9:15 AM"` sub-line; section header changed to `ACTIVITY` label style

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

## Best Practice Enhancements

### Session & Auth Hardening

**Proactive token expiry check in ProtectedRoute**
Currently, if a JWT has expired (14-day window), the user lands on the dashboard, queries fire, they get 401s, and only then get redirected. Better: decode the JWT on the client (no extra call needed — it's base64), check `exp`, and redirect before any API call if already expired. Avoids the flash of loading skeletons.

**"You've been signed out" toast on auto-logout**
The 401 interceptor currently redirects silently. Adding a URL param (`/login?reason=session_expired`) and showing a toast on the login page when that param is present gives users context instead of confusion.

**Cross-tab logout sync**
If a user logs out in Tab A, Tab B still has the old in-memory Zustand state. The next API call from Tab B will 401 and redirect correctly, but there's a brief window of stale state. Fix: use the [BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) or a `window` `storage` event listener in `authStore` to call `clearAuth()` across all open tabs the moment any tab signs out.

**Idle session timeout (optional)**
For security-conscious households (sitter access), add a configurable idle timeout (e.g. 8 hours). Track last activity timestamp, and if the gap exceeds the threshold on next load, auto-logout. Rails side: already has `timeoutable` in the Devise comment block — just needs `config.timeout_in`.

---

### Cold-Start & Reliability

**Server wake-up UX**
When an Axios request times out (20s), TanStack Query marks the query as errored, but the UI currently shows either a loading skeleton that never resolves or a silent empty state. Add an `isError` check in the dashboard so users see a "Can't reach the server — tap to retry" banner instead of an indefinitely broken page.

**Keep-alive ping to prevent Supabase pausing**
Supabase free tier pauses after 1 week of inactivity. A GitHub Actions scheduled workflow (cron every 3 days) that hits `GET /health` keeps both the DB and Render server warm simultaneously. Already called out in Technical Debt — worth prioritising before wider beta.

---

### Data & UX Quality

**Optimistic updates on care event logging**
`LogCareModal` currently waits for the API round-trip before updating the care log. Adding TanStack Query's `onMutate` / `onError` / `onSettled` pattern would make the log feel instant and roll back cleanly on failure — high impact on mobile where latency is more noticeable.

**Pagination or virtual list for care log**
`TodayCareLog` loads all of today's events at once. Households with multiple cats and frequent logging will accumulate 30–50+ rows/day. Add `limit`/`offset` on the `GET /care_events` endpoint (the meta envelope already supports `total`) and infinite-scroll or "load more" on the frontend.

**Soft-delete audit log**
When a care event is deleted, there's no record of it. A simple `deleted_at` + `deleted_by_id` on `CareEvent` (rather than a hard destroy) makes dispute resolution possible in shared households and is low effort to add.

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
- [ ] Open Care Settings → adjust feedings/day for a cat → verify badge updates on dashboard
- [ ] Add a custom portion preset → log a feeding → verify the preset appears as a quick-pick button
- [ ] Sign in with Google → lands on dashboard
- [ ] Archive a cat → verify it's hidden from dashboard
- [ ] Toggle dark mode → persists on refresh
- [ ] Test on mobile viewport (375px)
