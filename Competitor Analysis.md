Strategic Assessment: CatCare vs. EveryWag
------------------------------------------

### What EveryWag Actually Is

EveryWag is a **B2B vet-to-owner compliance platform**, not a household coordination tool. Clinics pay ($29–$99/mo) to send branded discharge guides and care reminders to pet owners. Their consumer features (expense tracking, push notifications, pet memorials) are secondary to that B2B core.

**Your differentiation is intact**: CatCare solves the _household coordination_ problem ("did anyone feed the cat?"). EveryWag solves the _vet-to-home_ handoff problem. These are complementary, not directly competing. However, EveryWag's consumer features reveal unmet needs worth evaluating.

What EveryWag Has That You're Missing
-------------------------------------

EveryWag FeatureStrategic Relevance for CatCare**Expense tracking**Real user pain point. Vet bills, food, grooming — one place. Simple to add.**Push notifications**Your email reminders have low open rates vs. push. Browser push or PWA could help.**Condition-specific tracking**Diabetic cats, hyperthyroid, CKD — these owners are your most engaged users.**Pet memorials**Emotional lock-in. Low-effort feature that creates deep attachment to the product.

Critical Gaps in Your Own Plan
------------------------------

### 1\. MVP Completion Blockers

These are incomplete per your own MVP definition:

*   **Email reminders** — explicitly "not built." The last true MVP item. ProcessPendingRemindersJob and SendReminderEmailJob still need to be written.
    
*   **Password reset + email verification** — in the plan scope, not in the "What's Built" table in CLAUDE.md. Unclear if built. This is an auth security gap.
    
*   **Reminder smart suppression** — without this, your reminders are annoying and users will disable them. In "Next Up" but blocking real usage.
    

### 2\. Missing Infrastructure (per your own CLAUDE.md rules)

*   ~~**No /health endpoint**~~ — ✅ Built. `GET /health` — DB check, no auth.

*   ~~**No Sentry**~~ — ✅ Built. Rails + React Sentry initialized; set `SENTRY_DSN` / `VITE_SENTRY_DSN` in production.

*   ~~**No CI/CD**~~ — ✅ Built. GitHub Actions: RSpec + Brakeman + Bundler Audit + TS build on every push.

*   ~~**No tests**~~ — ✅ Built. RSpec model specs + Pundit policy specs for Cat, CareEvent, HouseholdInvite. ⚠️ `HouseholdMembershipPolicy` manage actions still need specs (security gap).


### 3\. UX Flows Not Yet Built

*   ~~**No landing page**~~ \u2014 \u2705 Built. `LandingPage.tsx` at `/` with hero, value props, CTAs.

*   ~~**Onboarding flow**~~ \u2014 \u2705 Built. `OnboardingStepper` on setup + add-cat pages; skip link; `ProtectedRoute` household guard.

*   ~~**Household role management UI**~~ \u2014 \u2705 Built. Admins can promote/demote/remove members from the dashboard. Last-admin guard in place.

*   ~~**Cat archive/deceased status**~~ — ✅ Built. Archive + deceased from `CatProfilePage`; "Show archived" toggle on dashboard; restore with tier guard.


### 4\. Strategic Features### 4\. Strategic Features You're Missing That Aren't in Your Plan

*   **PDF/export for vet visits** — this is your direct counter to EveryWag. Owners carry care history to appointments. You have all the data; EveryWag's vet guides are the clinic-side version. A "Generate Vet Visit Summary" button (last 30/90 days, weight trend, medication history, notes) is a high-value, low-competition feature.
    
*   **Real-time updates** — currently requires a page refresh to see a household member's new care event. For the "did anyone feed the cat?" use case, this matters. WebSockets via ActionCable or polling via TanStack Query refetchInterval would help.
    
*   **PWA / installable mobile** — you're "web-first, designed for mobile," but there's no mention of making it installable. A manifest.json and service worker would let users add it to their home screen with zero native app development.
    
*   **Breed-specific fields used nowhere** — you capture breed on cat creation but don't use it for anything. Even surfacing average lifespan, common health issues, or linking to care guides by breed would add value.
    
*   **DECISIONS.md** — your own plan specifies this. It's a solo dev project. Without it, you'll forget why you made architectural choices.
    

Recommended Priority Order
--------------------------

### ✅ Completed (MVP infrastructure + UX gates)

*   ~~**/health endpoint**~~ — ✅ Done
*   ~~**Sentry setup**~~ — ✅ Done (set `SENTRY_DSN`/`VITE_SENTRY_DSN` in production)
*   ~~**CI/CD**~~ — ✅ Done (GitHub Actions)
*   ~~**RSpec + Pundit specs**~~ — ✅ Done for Cat, CareEvent, HouseholdInvite
*   ~~**Landing page**~~ — ✅ Done
*   ~~**Onboarding flow**~~ — ✅ Done
*   ~~**Role management UI**~~ — ✅ Done
*   ~~**Cat archive/deceased**~~ — ✅ Done (restore + tier guard complete)

### Now (Section 4 — localhost-ready, no email required)

1.  ~~**HouseholdMembershipPolicy specs**~~ — ✅ Done. 31 examples covering show?, update?, manage_update?, manage_destroy? across admin/member/sitter/outsider/inactive roles. Test DB migrations also applied (was missing 4 migrations). Full suite: 105 examples, 0 failures.
2.  ~~**Restore archived cats**~~ — ✅ Done. Backend tier guard added to `cats_controller#update` (restoring counts against active cat limit, returns TIER_LIMIT 403). Frontend bare `.then()` replaced with proper `useMutation` with loading state, TIER_LIMIT error handling, and cache invalidation.
3.  ~~**Password reset**~~ — ✅ Done. Dev queue adapter switched from `:sidekiq` to `:async` in `development.rb`. Password-reset emails now appear instantly in letter_opener_web at http://localhost:3000/letter_opener without needing a running Sidekiq process. All other infrastructure was already in place.
4.  ~~**"Needs attention" dashboard summary**~~ — ✅ Done. Added amber callout banner above cat cards listing each cat's pending tasks (feeding count, water, litter, teeth) with per-cat Log shortcut. Also fixed a bug where `track_toothbrushing` was excluded from the attention count while showing in the status badges.
5.  ~~**Medication tracking UI**~~ — ✅ Done. Extracted `MedicationsSection` component with focused query, active/stopped split, Stop + Reactivate mutations, tier guard on Log button. Replaced the broad all-events query with a targeted `eventTypes: ['medication']` query.
6.  ~~**Vet visit export**~~ — ✅ Done. `@react-pdf/renderer` generates a text-selectable A4 PDF with weight history, medication history, vet visits, symptoms, care summary, and care notes. `ExportPdfButton` uses 4 parallel queries (stats + medication events + vet_visit events + care notes) gated on `isExporting`. Free tier locked; Pro = 30d; Premium = all ranges. Button lives in `CatHistoryPage` controls row.
7.  ~~**Reminder management UI**~~ — ✅ Done. Fixed three pre-existing bugs first: (1) `ReminderPolicy` created and added to controller (`authorize` was missing — security gap), (2) `Reminder` model now has `care_type`/`schedule_type` enums, validations, `belongs_to :created_by`, `has_many :reminder_recipients`, (3) factory updated. Frontend: `Reminder` types, API methods, `reminderHelpers.ts` (`formatSchedule`), `RemindersSection` with inline RHF+Zod create form. "Coming soon" badge on each reminder sets honest expectations for email job (Phase 2). 14 new ReminderPolicy specs.

### Phase 2 (highest strategic value vs. EveryWag)

1.  **Email reminder job** — ProcessPendingRemindersJob + ReminderMailer (needs deployment)
2.  **Reminder smart suppression** — skip if care already logged today
3.  **PWA manifest** — makes mobile usage feel native, zero app store friction
4.  **Real-time updates** — ActionCable or TanStack Query `refetchInterval`
5.  **Expense tracking** — simple to add, high user value

### Phase 3

*   React Native mobile app
*   Push notifications
*   Multi-species
*   Stripe billing

The Bigger Strategic Picture
----------------------------

EveryWag's existence validates the market but also reveals your clearest opportunity: **you own the household coordination layer, and they own the vet communication layer**. The long-term move is to be the place where both meet — the app where a family coordinates daily care _and_ generates the health summary they bring to the vet, with vet-prescribed care guidelines feeding back into the same care log.

That positions CatCare as the **operating system for the cat's life**, not just a shared feeding tracker. EveryWag would be a natural integration partner, not just a competitor.