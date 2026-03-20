# CatCare: UI Modernization Plan

## Context

The MVP is functionally complete (auth, households, cat CRUD, care logging, dashboard, charts). However the UI is bare-bones — no shared layout/nav, minimal shadcn/ui adoption (only Button), "Loading..." text instead of skeletons, no toast feedback, emoji instead of icons, and `window.confirm()` for destructive actions. The goal is to transform this from a working prototype into a polished, modern SaaS app.

## Decisions
- **Navigation:** Top navbar only (sticky horizontal bar, hamburger → side sheet on mobile)
- **Scope:** UI modernization only (Phases 1–4). Launch readiness deferred to a future plan.

---

## Phase 1: Foundation — Shared Layout + Component Infrastructure

**Why:** Every page is currently standalone with no persistent navigation. This is the single biggest visual upgrade.

### Steps

1. **Install shadcn/ui components** — run `npx shadcn@latest add` for: `input`, `select`, `textarea`, `dialog`, `alert-dialog`, `card`, `avatar`, `badge`, `dropdown-menu`, `sheet`, `skeleton`, `separator`, `tooltip`, `tabs`, `sonner`
2. **Create `web/src/components/layout/AppLayout.tsx`**
   - Sticky top nav: CatCare logo (left), household name, dark mode toggle, user dropdown (right)
   - Mobile: hamburger → shadcn `Sheet` side drawer
   - Content area: `<Outlet />` in `max-w-4xl mx-auto px-4 py-6`
3. **Create `web/src/components/layout/PageHeader.tsx`** — reusable title + subtitle + action buttons
4. **Wire layout into `App.tsx`** — wrap protected routes in `AppLayout` as a layout route; auth pages stay outside
5. **Decompose `DashboardPage.tsx`** (768 lines → ~150 lines) into:
   - `components/dashboard/CatCard.tsx`
   - `components/dashboard/CatStatusBadges.tsx`
   - `components/dashboard/TodayCareLog.tsx`
   - `components/dashboard/MembersSection.tsx`
   - `components/dashboard/EmergencyContactSection.tsx`
   - `lib/helpers.ts` (date formatting, status helpers)

**Key files:** `App.tsx`, `DashboardPage.tsx`, `index.css`

---

## Phase 2: Forms, Toasts & Dialogs

**Why:** Custom `.input` CSS class → proper shadcn components; silent mutations → toast feedback.

1. **Add `<Toaster />` (Sonner)** to `AppLayout.tsx` — `richColors`, `position="top-right"`
2. **Replace all `.input` class usages** with shadcn `Input`, `Select`, `Textarea`, `Checkbox` across all pages (Login, Register, AddCat, EditCat, HouseholdSetup, HouseholdProfile, LogCareModal, dashboard sub-components)
   - Note: shadcn `Select` (Radix) requires `Controller` from react-hook-form, not `register()`
3. **Add toast notifications** to every `useMutation` — `toast.success()` on success, `toast.error()` on error
4. **Replace `window.confirm()`** with shadcn `AlertDialog` in `LogCareModal`
5. **Remove `.input` class** from `index.css`

**Key files:** All form pages, `LogCareModal.tsx`, `index.css`

---

## Phase 3: Loading Skeletons, Empty States & Visual Polish

**Why:** Replace bare "Loading..." text and missing empty states with designed components.

1. **Create skeleton components** in `components/skeletons/`:
   - `CatCardSkeleton.tsx`, `CareLogSkeleton.tsx`, `FormSkeleton.tsx`, `PageSkeleton.tsx`
   - Built on shadcn `<Skeleton />`
2. **Replace loading text** on: DashboardPage, CatProfilePage, EditCatPage, HouseholdProfilePage
3. **Create `components/EmptyState.tsx`** — Lucide icon + title + description + optional CTA
4. **Add empty states** for: no cats, no household, empty care log, no care history
5. **Replace emoji with Lucide icons** — cat avatars, event type icons in status badges and quick-action buttons, close buttons
6. **Adopt shadcn `Card`** — wrap cat cards, member list, emergency contact, stat cards, chart cards

**Key files:** All pages with loading states, `CatCard.tsx`, `CatStatusBadges.tsx`, `CatHistoryPage.tsx`

---

## Phase 4: Dark Mode, Animations & Responsive Polish

**Why:** The finishing touches that make the app feel alive and modern.

1. **Dark mode toggle** — create `store/themeStore.ts` (Zustand, persisted as `catcare_theme`), apply `.dark` class to `<html>`, toggle in nav with `Sun`/`Moon`/`Monitor` icons
   - CSS variables already fully defined in `index.css` — no CSS changes needed
   - Risk: Recharts uses inline colors; chart components may need theme-aware color values
2. **Page transitions** — install `framer-motion`, add `<AnimatePresence>` in `AppLayout` with subtle fade+slide (150ms)
3. **Micro-interactions** (Tailwind only):
   - Cat cards: `hover:shadow-md hover:-translate-y-0.5 transition-all`
   - Quick-action buttons: `active:scale-95 transition-transform`
   - LogCareModal: slide-up animation via framer-motion
4. **Page titles** — create `hooks/usePageTitle.ts`, add to every page
5. **Responsive polish** — widen dashboard from `max-w-sm` to responsive (`max-w-sm sm:max-w-md lg:max-w-lg`), safe-area-inset padding, verify mobile touch targets

**Key files:** `AppLayout.tsx`, `LogCareModal.tsx`, all pages

---

## Execution Order

```
Phase 1 (Foundation)  ← MUST be first, everything builds on the layout
  ↓
Phase 2 (Forms/Toasts) ← right after Phase 1
  ↓
Phase 3 (Skeletons/Empty states) ← can overlap with late Phase 2
  ↓
Phase 4 (Dark mode/Animations) ← requires Phase 1 layout
```

## Verification

After each phase:
- Start dev servers: `start-web.bat` and `start-api.bat`
- Walk through all routes: login → dashboard → add cat → cat profile → edit cat → care history → household profile
- Verify on mobile viewport (Chrome DevTools, 375px width)
- After Phase 4: toggle dark mode, verify all pages + charts render correctly

## Risks

1. **shadcn Select + React Hook Form:** Radix Select requires `Controller` instead of `register()` — most error-prone part of Phase 2
2. **DashboardPage decomposition:** 768 lines with tightly coupled state; plan prop interfaces before extracting
3. **Dark mode chart colors:** Recharts uses inline colors; chart components need theme-aware values in Phase 4
4. **framer-motion bundle:** ~30KB gzipped; acceptable but worth checking in build analysis
