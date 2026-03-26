# Global Claude Instructions


These rules apply to every project.


## Root Cause


No quick fixes. Always diagnose to the root cause and devise proper solutions. Never apply patches or workarounds unless the user explicitly asks.


---


## Security & Secrets


- Never hardcode secrets or commit them to git
- Use separate API tokens/credentials for dev, staging, and prod environments
- Validate all input server-side — never trust client data
- Add rate limiting on auth and write operations


## Architecture & Code Quality


- Design architecture before building — don't let it emerge from spaghetti
- Break up large view controllers/components early
- Wrap external API calls in a clean service layer (easier to cache, swap, or extend later)
- Version database schema changes through proper migrations
- Use real feature flags, not commented-out code


## Observability


- Add crash reporting from day one
- Implement persistent logging (not just console output)
- Include a `/health` endpoint for every service


## Environments & Deployment


- Maintain a real staging environment that mirrors production
- Set CORS to specific origins, never `*`
- Set up CI/CD early — deploys come from the pipeline, not a laptop
- Document how to run, build, and deploy the project


## Testing & Resilience


- Test unhappy paths: network failures, unexpected API responses, malformed data
- Test backup restores at least once — don't wait for an emergency
- Don't assume the happy path is sufficient


## Time Handling


- Store all timestamps in UTC
- Convert to local time only on display


## Discipline


- Fix hacky code now or create a tracked ticket with a deadline — "later" never comes
- Don't skip fundamentals just because the code compiles and runs

---



# CatCare — Claude Developer Guide

Binding instructions for AI-assisted development. Follow exactly.

Full product plan: `C:\Users\mjsha\.claude\plans\pure-tumbling-hopcroft.md`

---

## Project Structure

```
CatCare/
  api/     — Rails 8.1.2 API-only, PostgreSQL
  web/     — React 18, TypeScript, Vite 7
  catcare/ — IGNORE (unrelated nested directory)
```

---

## Environment (Windows)

```bash
export PATH="$PATH:/c/Ruby40-x64/bin:/c/Program Files/PostgreSQL/18/bin"
ridk.cmd exec bundle exec rails <command>
```

- PostgreSQL: `host: localhost` (no Unix sockets)
- Credentials: `api/.env` (gitignored — never commit)
- Servers: web `localhost:5173`, API `localhost:3000`
- RSpec: `ridk.cmd exec bundle exec rspec`

---

## Non-Negotiable Rules

### Security
- Every controller action through Pundit — no exceptions
- Never `Model.find(id)` — always scope to `current_household` or `current_user`
- Routes: all under `/api/v1/`
- JWT + JTI denylist on logout

### API Response Contract
```json
{ "data": {...} }
{ "data": [...], "meta": { "total": N } }
{ "error": "ERROR_CODE", "message": "..." }
```
Frontend access pattern: `response.data.data` (Axios wrapper → Rails envelope → resource)

### Rails Patterns
- `current_household` helper in `BaseController` — always use it
- `occurred_at` for care events, never `created_at` (user-adjustable)
- Load JSONB `details` with string keys: `e.details["weight_value"]`
- Load aggregations in Ruby/SQL, not JavaScript

### Frontend Patterns
- Server state → TanStack Query only (no bare `useEffect` for data fetching)
- Client state → Zustand (`authStore` + `themeStore`, both persisted to localStorage)
- Forms → React Hook Form + Zod
- All API calls → `web/src/api/client.ts` (JWT interceptor is here)
- UI components → Base UI via shadcn (NOT Radix). `DropdownMenuTrigger`/`SheetTrigger` use `render` prop, not `asChild`
- `DropdownMenuLabel` requires a `DropdownMenuGroup` parent in Base UI — use a plain `div` for presentational headers

---

## Infrastructure

### Health Endpoint
`GET /health` — public, no auth. Returns `{ status: "ok", db: "connected" }` or 503 if DB is down. Use this for uptime monitors and load balancer health checks.

### Sentry
- **Rails**: `config/initializers/sentry.rb` — reads `SENTRY_DSN` env var. Only active in `production`/`staging`. Set `SENTRY_DSN` in your hosting environment's secrets.
- **React**: initialized in `web/src/main.tsx` — reads `VITE_SENTRY_DSN`. No-ops silently if the env var is absent (safe in dev).
- Install after adding to manifests: `ridk.cmd exec bundle install` (api), `npm install` (web).

### CI/CD
GitHub Actions workflow at `.github/workflows/ci.yml`. Runs on every push/PR to `main`/`master`:
- **api job**: RSpec → Brakeman static analysis → Bundler Audit CVE check
- **web job**: `tsc --noEmit` type check → `npm run build`
- Required GitHub secret: `RAILS_MASTER_KEY`

### Testing
Run specs: `ridk.cmd exec bundle exec rspec`

Spec locations:
- `spec/models/` — model validations and associations
- `spec/policies/` — Pundit authorization rules (security-critical)
- `spec/factories/` — FactoryBot factories for all models

New policy specs must be added whenever a new policy is created. Pundit policy bugs are security bugs.

---

## Care History Dashboard

Route: `/households/:householdId/cats/:catId/history`

**API endpoint:** `GET /api/v1/households/:household_id/cats/:id/stats?range=7d|30d|90d`

Returns: `{ by_type, by_day, weight_series, by_member, total_events, start_date, end_date }`

**Charts (all in `web/src/components/charts/`):**
- `WeightTrendChart` — AreaChart, green gradient fill, conditional (hidden if no weight events)
- `FeedingFrequencyChart` — bar, amber, Cell-colored by intensity
- `CareTypeBreakdownChart` — horizontal bar sorted descending, WCAG AAA; uses `EVENT_COLORS`
- `MemberContributionChart` — horizontal bar, purple (#a78bfa) fill, LabelList value labels
- `CareActivityHeatmap` — hand-built CSS grid (no Recharts), weekday-aligned
- `ChartCard` — shared card wrapper with `forwardRef` + drag handle; used by all 5 charts

`staleTime: 5 * 60 * 1000` on stats query. Never put chart queries on the main dashboard.

**Drag-and-drop + resize (react-grid-layout):**
- Library: `react-grid-layout` (WidthProvider + Responsive)
- Default layout + localStorage helpers: `web/src/lib/chartLayout.ts`
- Layout keyed per-cat: `catcare_chart_layout_${catId}` in localStorage
- `draggableHandle=".drag-handle"` — only the grip icon initiates drag (preserves chart interactions)
- Conditional charts (`weight`, `member`) have their positions preserved in `handleLayoutChange` even when hidden, so they return to the right spot when data appears
- v4 API: `useContainerWidth()` hook provides `{ width, containerRef }` — wrap grid in `<div ref={containerRef}>` and pass `width` to `<ResponsiveGridLayout>`
- v4 API: `dragConfig={{ handle: '.drag-handle' }}` (not `draggableHandle` prop)
- v4 API: `resizeConfig={{ handles: ['se'] }}` (not `resizeHandles` prop)
- v4 types: `ResponsiveLayouts` (not `Layouts`), `LayoutItem` (not `Layout` for single items)

---

## Data Model

```
User            — devise + jti (JWT denylist)
Household       — name, created_by_id, emergency_contact_name, emergency_contact_phone
HouseholdMembership — household_id, user_id, role [admin|member|sitter], status, phone,
                      emergency_contact_name, emergency_contact_phone, notes
HouseholdInvite — token (unique), expires_at, status [pending|accepted|expired], role
Cat             — household_id, name, species, active (soft delete),
                  vet_name, vet_clinic, vet_phone, vet_address, care_instructions,
                  feedings_per_day (int, default 1), track_water (bool), track_litter (bool),
                  feeding_presets (jsonb), photo (Active Storage)
CareEvent       — cat_id, household_id (denorm), logged_by_id, event_type (enum),
                  occurred_at (indexed), notes, details (jsonb)
Reminder        — cat_id, next_trigger_at (indexed)
ReminderRecipient — reminder_id, user_id
```

**Event types (enum int):** feeding=0, litter=1, water=2, weight=3, note=4, medication=5, vet_visit=6, grooming=7

**JSONB details shapes:**
- feeding: `{ food_type, amount_grams }`
- weight: `{ weight_value, weight_unit }`
- medication: `{ medication_name, dosage, unit }` — unit is `mg` | `ml` | `tablet`

---

## File Map

```
api/app/controllers/
  health_controller.rb      — GET /health, no auth, checks DB connectivity

api/app/controllers/api/v1/
  base_controller.rb        — current_household, render_success/error helpers
  cats_controller.rb        — CRUD + stats action + Pundit; ?include_inactive for archived cats
  care_events_controller.rb — index/create/update/destroy + Pundit
  households_controller.rb
  household_invites_controller.rb — role param + accept flow + Pundit
  memberships_controller.rb       — self profile (show/update) + admin manage_update/manage_destroy
  oauth_controller.rb             — POST /api/v1/auth/google; verifies Google ID token via tokeninfo endpoint, finds-or-creates user, returns CatCare JWT

api/app/policies/
  cat_policy.rb                    — sitter: read-only; admin/member: full CRUD
  care_event_policy.rb             — sitter: create + own events; others: full
  household_invite_policy.rb       — admin only for create; non-sitter for index/destroy
  household_membership_policy.rb   — own record: show/update; admin: manage_update/manage_destroy (no specs yet)

api/config/initializers/
  sentry.rb                 — Sentry error tracking; reads SENTRY_DSN env var

api/spec/
  rails_helper.rb           — RSpec + FactoryBot + shoulda-matchers + pundit-matchers
  spec_helper.rb
  models/                   — User, Cat, CareEvent, HouseholdMembership specs
  policies/                 — CatPolicy, CareEventPolicy, HouseholdInvitePolicy specs
  factories/                — FactoryBot factories for all models

.github/workflows/
  ci.yml                    — GitHub Actions: RSpec + Brakeman + audit + TS build

web/src/
  api/client.ts             — Axios instance, JWT interceptor, all api.* methods
  lib/eventColors.ts        — EVENT_COLORS and EVENT_LABELS per event type
  lib/helpers.ts            — date formatting, status helpers
  types/api.ts              — all TypeScript interfaces (User, Cat, CareEvent, CatStats…)
  store/
    authStore.ts            — Zustand, persisted as 'catcare_auth'
    themeStore.ts           — Zustand, persisted as 'catcare_theme' (light|dark|system)
  hooks/
    useApplyTheme.ts        — applies .dark to <html>, respects OS matchMedia for system
    usePageTitle.ts         — sets document.title as "{title} · CatCare"
  components/
    EmptyState.tsx          — reusable: Lucide icon + title + description + optional CTA
    LogCareModal.tsx        — full care logging (all 8 types + edit/delete + AlertDialog confirm); reads feeding_presets from cat prop for quick-pick portion buttons
    layout/
      AppLayout.tsx         — sticky navbar, user dropdown, theme toggle, mobile sheet
      PageHeader.tsx        — reusable title + subtitle + back link + action slot
    dashboard/
      CatCard.tsx           — cat card with status badges + quick-action buttons
      CatStatusBadges.tsx   — fed/litter/water status badges
      TodayCareLog.tsx      — today's care event list
      MembersSection.tsx    — member list + role management + invite form (admin only)
      EmergencyContactSection.tsx
      HouseholdVetSection.tsx     — shared vet contact for the household; tap-to-call on mobile
      UpcomingAppointmentsSection.tsx — future-dated vet/grooming events shown as upcoming appointments
      BatchActionModal.tsx        — log the same care event for multiple cats in one action
    skeletons/
      PageSkeleton.tsx      — generic page loading skeleton (header + content blocks)
      CatCardSkeleton.tsx   — cat card shape skeleton
      CareLogSkeleton.tsx   — care log rows skeleton
    charts/                 — WeightTrend, FeedingFrequency, CareTypeBreakdown,
                              MemberContribution, CareActivityHeatmap, ChartCard
  lib/
    eventColors.ts          — EVENT_COLORS and EVENT_LABELS per event type
    helpers.ts              — date formatting, status helpers
    chartLayout.ts          — ChartId type, DEFAULT_LAYOUTS, loadLayouts/saveLayouts/clearLayouts
  pages/
    DashboardPage.tsx       — today's care, cat cards, archived cats toggle, quick-log buttons
    CatProfilePage.tsx      — cat details + sitter info + archive/deceased actions
    EditCatPage.tsx         — edit all cat fields + sitter info + photo upload
    CatHistoryPage.tsx      — stats dashboard with 5 charts
    HouseholdProfilePage.tsx — membership profile (phone, emergency contact, notes)
    HouseholdSettingsPage.tsx — admin-only; per-cat care requirements (feedings/day, water, litter) + feeding portion preset editor
    LandingPage.tsx         — public landing page at /
    AddCatPage.tsx, HouseholdSetupPage.tsx, LoginPage.tsx, RegisterPage.tsx, InvitePage.tsx
```

---

## Common Mistakes

1. **N+1** — use `includes()`; bullet gem fires in dev
2. **Unscoped queries** — always `current_household.cats.find(...)`, never `Cat.find(...)`
3. **Missing Pundit** — `policy_scope()` in index, `authorize` in all others
4. **Wrong time field** — `occurred_at` (user-set), not `created_at`
5. **Stats on dashboard** — `CatHistoryPage` only; keeps dashboard query-light
6. **JSONB string keys** — Rails reads back as strings: `details["weight_value"]` not `details[:weight_value]`
7. **Base UI DropdownMenuLabel** — requires `DropdownMenuGroup` parent; use plain `div` for presentational headers
8. **feeding_presets defaults** — `LogCareModal` falls back to `DEFAULT_PRESETS` if `cat.feeding_presets` is null; never assume the column is populated on existing rows before migration
