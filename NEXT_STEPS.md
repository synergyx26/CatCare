# CatCare — Next Steps & Enhancement Log

**Current status:** MVP deployed and functional. Beta testing with 2-person household.

---

## Recently Completed

### UI/UX & Accessibility Pass ✅ *(2026-04-12)*
- **Typography:** Replaced Geist Variable (developer font) with **Varela Round** (headings) + **Nunito Sans Variable** (body) — warmer, rounder typeface better suited to a pet care product
- **Accessibility — ARIA labels:** All icon-only buttons now have `aria-label`; emoji badges in `CatStatusBadges` have `role="status"` + `aria-label`; decorative icons have `aria-hidden="true"`
- **Accessibility — Forms:** All `<label>` elements linked to inputs via `htmlFor`/`id` across `LogCareModal`, `AddMedicationModal`, `QuickLogDoseSheet`; required fields marked with `aria-required` and `*` indicator
- **Accessibility — Pill selector groups:** All radio-style pill groups (event type, food type, symptom type, severity, frequency, unit) upgraded to `role="radiogroup"` + per-pill `role="radio" aria-checked`
- **Accessibility — Modals:** `LogCareModal`, `AddMedicationModal`, `QuickLogDoseSheet` now have `role="dialog" aria-modal="true" aria-labelledby`
- **Accessibility — MedicationCard:** Expand/collapse button has `aria-controls`/`aria-expanded`; ⚠ missed dose warnings have `role="alert"`; edit button has descriptive `aria-label`
- **Inline validation errors:** `LogCareModal` now shows inline `role="alert"` error messages under required fields (medication name, vet reason, weight) on submit attempt
- **Active nav state:** Dashboard nav link highlights active page with `bg-sky-50` tint + `aria-current="page"` on both desktop and mobile
- **Theme toggle:** `aria-label` now describes the action + current state ("Switch to dark mode (currently light)")
- **Close buttons:** Replaced `✕` emoji buttons in `AddMedicationModal` and `QuickLogDoseSheet` with `<X />` Lucide icon + proper `aria-label="Close dialog"`
- **Dark mode consistency:** Standardized tint opacity scale (`--dm-tint-subtle` 10%, `--dm-tint-soft` 20%, `--dm-tint-medium` 35%) documented in `index.css`; CatCard birthday ring/avatar tints unified
- **Nav aria-labels:** Both desktop and mobile `<nav>` elements have `aria-label="Main navigation"`
- **.gitignore:** Added `.claude/` (Claude Code internals) and `catcare/` (unrelated nested directory)

### Bug Fixes & UI Polish ✅ *(2026-04-11)*
- **Stats off-by-one (today missing from heatmap):** `start_time` formula in `cats_controller#stats` generated N buckets covering days-N through day-1, excluding today. Fixed to `(days * offset + days - 1).days.ago` so the current period always includes the current day.
- **Expired vacation trips returned as active:** `Household#active_vacation_trip` used `where(active: true)` alone — since `active` defaults to `true`, ended trips were returned. Fixed by chaining `.active_on(Date.today)` (date-range SQL scope on VacationTrip).
- **VacationTrip `active?` method missing:** Added instance method and `active_on(date)` scope to `vacation_trip.rb`; fixed 3 failing RSpec examples.
- **UserMailer spec apostrophe failure:** Rails HTML-escapes `O'Name` → `O&#39;Name` in ERB; `.decoded` only handles transfer encoding. Fixed by wrapping with `CGI.unescapeHTML()`.
- **Calendar cells touching / Saturday border clip:** Removed all cell borders from `HouseholdCalendarPage` and `CalendarViewChart`; switched to background-fill-only state system (`bg-muted/20`, `bg-primary/10`, `bg-sky-50/80`); increased gap to `gap-2`; removed `overflow-hidden` that was clipping the Saturday cell's own rounded border on WebKit. Both calendar implementations updated to match.

### Vacation Mode ✅ *(2026-04-09)*
- `VacationTrip` model: date range + sitter visit frequency (days between visits)
- Admin creates/ends trips via `/households/:id/vacation`; sitter frequency widens care status checks from "done today?" to "done in the last N days?"
- Sitters see a task checklist instead of daily status cards during active trip
- Owner dashboard shows a banner with last sitter activity when a trip is active

### Household Care Calendar ✅ *(2026-04-08)*
- `HouseholdCalendarPage` at `/households/:id/calendar` — monthly view of all care events across the household
- Full CRUD from the calendar: click any past day to open a day panel with edit/delete; click future day to pre-fill `occurred_at` in `LogCareModal`
- Pro/Premium only (free users see upgrade wall); month navigation clamped by tier
- Client-side cat/type/member filters; mobile day panel uses bottom sheet layout

### Navigation Restructure + Care History Table ✅ *(2026-04-07)*
- Desktop: Insights dropdown (Calendar + Care History), Settings dropdown (Household / Care / Notifications), avatar = identity + sign-out only
- Mobile: mirrors same structure with collapsible Insights and Settings sections
- Locked items (Calendar for free, Care History for free/pro) show Lock icon + tier badge
- Care History Table: full paginated event log; tier-gated (Premium only)

### Medication History & Tracking Page ✅ *(2026-04-07)*
- `MedicationsPage` at `/households/:id/cats/:catId/medications` — dedicated medication view
- Active vs. stopped split; Stop + Reactivate mutations; medication adherence log
- Tier guard on Log button (Pro/Premium only for medication event type)

### Email Reminders ✅ *(2026-03-28)*
- `ProcessPendingRemindersJob`: runs every minute via sidekiq-cron; smart suppression (skips if care already logged today); advances schedule after firing; Sentry on error
- `UserMailer#reminder_notification`: HTML + plain-text templates; links to dashboard + notification settings
- Production delivery via Resend HTTPS API (`RESEND_API_KEY` env var on Render); falls back to `:logger` if key absent
- Dev preview via `letter_opener_web` at `http://localhost:3000/letter_opener`
- `notification_preferences` JSONB column on users controls opt-out per category (care_reminders, medication_alerts, vet_appointments)

### Notification Preferences ✅ *(2026-03-28)*
- `NotificationSettingsPage` at `/notification-settings` — per-user toast, email, and push settings
- In-app: enabled toggle, position, duration, per-category toggles
- Email: enabled toggle, per-category toggles (care reminders, medication alerts, vet appointments)
- Settings stored in `notification_preferences` JSONB (DB default ensures existing users are opted in)

### Vet PDF Export ✅ *(2026-03-27)*
- `ExportPdfButton` + `VetSummaryDocument` (react-pdf/renderer): A4 document covering weight history, active medications, vet visits, symptoms, and care summary
- Tier-gated: Free=locked, Pro=30d history, Premium=all history
- 4 parallel queries assembled via `assembleVetSummary()` in `lib/vetExport.ts`

### Session State & Auth Reliability ✅ *(2026-03-27)*
- Axios 20s timeout: API requests fail fast on Render cold starts instead of hanging indefinitely
- `clearAuth()` on 401: previously `isAuthenticated: true` survived token expiry in localStorage, requiring a full browser restart to recover
- `queryClient.clear()` on login: stale cache from a prior session no longer produces empty dashboard on re-login

### Care Settings & Feeding Portion Presets ✅ *(2026-03-26)*
- `feedings_per_day`, `track_water`, `track_litter` per cat; dashboard badges and attention count respect per-cat settings
- `feeding_presets` JSONB: admins set gram presets per food type in Care Settings; quick-pick buttons appear in feeding log
- Care Settings page (`/households/:id/settings`, admin-only)

### Care History Charts ✅ *(2026-03-26)*
- 5 chart types: WeightTrendChart (AreaChart), FeedingFrequencyChart, CareTypeBreakdownChart (horizontal bar, WCAG AAA), MemberContributionChart, CareActivityHeatmap
- Drag-and-drop + resize via react-grid-layout; layout persisted per-cat in localStorage
- `staleTime: 5 * 60 * 1000` — charts never loaded on dashboard

### Google OAuth ✅ *(2026-03-26)*
- `OauthController` verifies ID token against Google tokeninfo endpoint; finds-or-creates user; returns CatCare JWT
- `GoogleOAuthButton` on login/register pages

### Subscription Tier Enforcement ✅ *(2026-03-25)*
- Backend: 403 TIER_LIMIT on cat create, event type create, member invite, stats range/offset
- Frontend: locked pills, lock icons, upgrade toasts across LogCareModal, BatchActionModal, DashboardPage, MembersSection, AppLayout nav

---

## Pending Issues

### 1. Upgrade Email Sender to a Verified Custom Domain
**Current state:** Email delivery is working end-to-end. The app uses Resend's shared sender domain (`onboarding@resend.dev`).

**Limitation:** Resend only delivers emails sent from the shared domain to the single email address registered on the Resend account. Real users will never receive reminder emails until a custom domain is verified.

**What to do:**
1. Register or point a domain you own (even a cheap subdomain like `mail.catcare.app`)
2. Add + verify it at resend.com/domains (adds TXT/MX DNS records)
3. Update `MAILER_SENDER` on Render to `noreply@yourdomain.com`

No code changes required — it's purely a Resend + Render config update.

---

### 2. Persistent File Storage for Cat Photos
**What's missing:** Photos use Render's ephemeral disk — wiped on every deploy.

**Recommended fix:** Supabase Storage (S3-compatible, free tier generous):
- Add `gem "aws-sdk-s3"` to Gemfile
- Add an S3 service block in `config/storage.yml` pointing to Supabase Storage endpoint
- Set `config.active_storage.service = :supabase_storage` in `production.rb`
- Add `SUPABASE_STORAGE_*` env vars to Render

---

### 3. Password Reset Flow — Needs End-to-End Verification
**What's built:** `PasswordsController` API + `UserMailer#reset_password_instructions` template + Resend delivery.

**What to verify:** Request reset → email arrives → link works → password updates successfully.

---

## Phase 2 Features (from product plan)

### Improved Onboarding
The `OnboardingStepper` component exists. Review new-user flow for both paths: fresh household creation and arriving via an invite link. Ensure neither has dead ends or missing redirects.

### Proactive Token Expiry Check
Decode JWT client-side (base64, no extra call), check `exp` in `ProtectedRoute`, and redirect before any API call fires if already expired. Avoids the flash of loading skeletons on stale sessions.

### "You've been signed out" Toast on Auto-Logout
The 401 interceptor redirects silently. Add `?reason=session_expired` to the redirect URL and show a toast on the login page when that param is present.

### Cross-Tab Logout Sync
If a user logs out in Tab A, Tab B holds stale Zustand state until its next API call 401s. Fix: `BroadcastChannel` or `window storage` event listener in `authStore` to call `clearAuth()` across all tabs on sign-out.

---

## Phase 3 Features (future expansion)

### Native Mobile App
React Native + Expo. The Rails API is already mobile-ready. Priority: iOS first.

### Push Notifications
APNs/FCM via Expo Notifications. The `Reminder` model + `ProcessPendingRemindersJob` infrastructure is in place — push would be an additional delivery channel alongside email.

### Vaccination Tracking
New model: `Vaccination` (cat_id, vaccine_name, administered_at, expires_at). Expiration reminders via the existing Sidekiq reminder infrastructure.

### Multi-Species Support
`Cat.species` enum exists. Needs: species-specific care types, UI labeling, default reminder templates.

---

## Technical Debt

### Email — Shared Resend Domain (deliver to owner only)
Currently using `onboarding@resend.dev` (Resend's shared test domain). Emails only deliver to the Resend account owner's email address — not to real users. Fix: verify a custom domain at resend.com/domains and update `MAILER_SENDER` on Render. No code changes needed.

### HouseholdMembership Policy Specs
`household_membership_policy.rb` has no spec. Any changes to membership authorization logic are unverified. Add `spec/policies/household_membership_policy_spec.rb`.

### Render Free Tier Spin-Down
API sleeps after 15 minutes of inactivity; first-request latency after sleep is ~30s. Fix: upgrade to Render Starter ($7/mo) when the app has regular users.

### Supabase Free Tier Pausing
Supabase pauses after 1 week of no activity. Fix: GitHub Actions scheduled workflow pinging `GET /health` every 3 days, or upgrade to Supabase Pro ($25/mo).

### Cloudinary Re-integration
`cloudinary` gem v2.x is incompatible with Rails 8.1 + Ruby 4.0. Monitor [releases](https://github.com/cloudinary/cloudinary_gem/releases). When compatible: add gem, set `active_storage.service = :cloudinary` in production, add `CLOUDINARY_URL` to Render.

---

## Smoke Test Checklist (run after each deploy)

- [ ] `GET /health` → `{"status":"ok","db":"connected"}`
- [ ] Register new account
- [ ] Create household + add cat
- [ ] Log all 8 care event types
- [ ] Edit and delete a care event
- [ ] Upload cat photo
- [ ] Invite a second user → accept → both see shared dashboard
- [ ] View cat history page → all 5 charts render with data
- [ ] Open Care Settings → adjust feedings/day → verify badge updates
- [ ] Add a custom portion preset → log feeding → verify quick-pick button appears
- [ ] Sign in with Google → lands on dashboard
- [ ] Archive a cat → verify hidden from dashboard
- [ ] Toggle dark mode → persists on refresh
- [ ] Open calendar → navigate months → log event from calendar day → verify in care log
- [ ] Create a vacation trip → verify sitter view shows task checklist
- [ ] Create a reminder → verify email arrives (check `/letter_opener` in dev, Resend dashboard in prod)
- [ ] Test on mobile viewport (375px)
