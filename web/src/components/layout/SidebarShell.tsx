import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  PawPrint,
  Home,
  CalendarDays,
  TableProperties,
  ReceiptText,
  Settings2,
  User,
  Stethoscope,
  Plane,
  Bell,
  Lock,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Ellipsis,
} from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'
import { notify } from '@/lib/notify'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Household } from '@/types/api'

interface NavEntry {
  key: string
  label: string
  icon: typeof Home
  path: string
  /** Shown instead of navigating when the user's tier is too low. */
  lockedTier?: 'pro' | 'premium'
  badge?: string
}

interface SidebarShellProps {
  household?: Household
  userName?: string
  isAdmin: boolean
  canAccessCalendar: boolean
  canAccessCareHistory: boolean
  canAccessExpenses: boolean
  /** Items for the household-switcher dropdown (same as the top-bar variant). */
  householdMenuItems: ReactNode
  /** Items for the user dropdown (same as the top-bar variant). */
  userMenuItems: ReactNode
  /** Theme / playful / nav-style toggle buttons. */
  controls: ReactNode
  children: ReactNode
}

function TierPill({ tier }: { tier: 'pro' | 'premium' }) {
  return (
    <span
      className={cn(
        'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        tier === 'premium'
          ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
          : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
      )}
    >
      {tier}
    </span>
  )
}

export function SidebarShell({
  household,
  userName,
  isAdmin,
  canAccessCalendar,
  canAccessCareHistory,
  canAccessExpenses,
  householdMenuItems,
  userMenuItems,
  controls,
  children,
}: SidebarShellProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const collapsed = useThemeStore((s) => s.navCollapsed)
  const setCollapsed = useThemeStore((s) => s.setNavCollapsed)
  const [moreOpen, setMoreOpen] = useState(false)

  const hid = household?.id
  const dashboard: NavEntry = { key: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' }

  const insights: NavEntry[] = hid
    ? [
        { key: 'calendar', label: 'Calendar', icon: CalendarDays, path: `/households/${hid}/calendar`, lockedTier: canAccessCalendar ? undefined : 'pro' },
        { key: 'history', label: 'Care History', icon: TableProperties, path: `/households/${hid}/care-history`, lockedTier: canAccessCareHistory ? undefined : 'premium' },
        { key: 'expenses', label: 'Expenses', icon: ReceiptText, path: `/households/${hid}/expenses`, lockedTier: canAccessExpenses ? undefined : 'premium' },
      ]
    : []

  const settings: NavEntry[] = hid
    ? [
        { key: 'profile', label: 'Household', icon: User, path: `/households/${hid}/profile` },
        ...(isAdmin
          ? [
              { key: 'contacts', label: 'Contacts & Vets', icon: Stethoscope, path: `/households/${hid}/contacts` },
              { key: 'care', label: 'Care', icon: Settings2, path: `/households/${hid}/settings` },
              {
                key: 'vacation',
                label: 'Vacation Mode',
                icon: Plane,
                path: `/households/${hid}/vacation`,
                badge: household?.active_vacation_trip ? 'active' : undefined,
              },
            ]
          : []),
        { key: 'notifications', label: 'Notifications', icon: Bell, path: '/notification-settings' },
      ]
    : [{ key: 'notifications', label: 'Notifications', icon: Bell, path: '/notification-settings' }]

  const isActive = (e: NavEntry) =>
    e.path === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(e.path)
  const settingsActive = settings.some(isActive)
  const [settingsOpen, setSettingsOpen] = useState(settingsActive)

  function go(e: NavEntry) {
    if (e.lockedTier) {
      notify.tierLimit(`${e.label} is available on the ${e.lockedTier === 'pro' ? 'Pro' : 'Premium'} plan`)
      return
    }
    setMoreOpen(false)
    navigate(e.path)
  }

  function renderItem(e: NavEntry, opts: { nested?: boolean; sheet?: boolean } = {}) {
    const active = isActive(e)
    const Icon = e.lockedTier ? Lock : e.icon
    const showLabel = opts.sheet || !collapsed
    return (
      <button
        key={e.key}
        type="button"
        onClick={() => go(e)}
        aria-current={active ? 'page' : undefined}
        aria-disabled={e.lockedTier ? true : undefined}
        title={collapsed && !opts.sheet ? e.label : undefined}
        className={cn(
          'relative flex w-full items-center gap-3 rounded-lg text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          opts.sheet ? 'px-3 py-3 text-base' : opts.nested ? 'px-2.5 py-1.5 text-[13px]' : 'px-2.5 py-2',
          !showLabel && 'justify-center px-0',
          active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          e.lockedTier && 'opacity-65',
        )}
      >
        {active && !opts.sheet && (
          <span aria-hidden="true" className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-primary" />
        )}
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {showLabel && <span className="truncate">{e.label}</span>}
        {showLabel && e.lockedTier && <TierPill tier={e.lockedTier} />}
        {showLabel && e.badge && (
          <span className="ml-auto shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
            {e.badge}
          </span>
        )}
      </button>
    )
  }

  const sectionLabel = (text: string) =>
    collapsed ? (
      <div className="mx-2 my-2 border-t border-border" aria-hidden="true" />
    ) : (
      <p className="px-2.5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{text}</p>
    )

  // Pill: the most-used destinations. Everything else lives behind "More".
  const pillItems: NavEntry[] = [dashboard, ...insights.filter((e) => e.key !== 'expenses')]

  return (
    <div data-slot="app-shell" className="min-h-screen bg-gradient-to-b from-primary/5 to-background dark:from-primary/[0.07] dark:to-background">
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside
        data-slot="app-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-background px-3 py-3 transition-[width] duration-200 md:flex',
          collapsed ? 'w-[72px]' : 'w-62',
        )}
      >
        <Link to="/dashboard" className={cn('flex items-center gap-2.5 px-1.5 pb-3 font-semibold tracking-tight', collapsed && 'justify-center px-0')}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PawPrint className="size-4" />
          </div>
          {!collapsed && <span>CatCare</span>}
        </Link>

        {household && (
          <DropdownMenu>
            <DropdownMenuTrigger
              title={collapsed ? household.name : undefined}
              className={cn(
                'mb-1 flex w-full items-center gap-2 rounded-xl border border-border p-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                collapsed && 'justify-center border-transparent p-1.5',
              )}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                {household.name.charAt(0).toUpperCase()}
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1 truncate font-medium">{household.name}</span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side={collapsed ? 'right' : 'bottom'} sideOffset={8} className="w-64">
              {householdMenuItems}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-3 -mx-3 pt-2" aria-label="Main navigation">
          {renderItem(dashboard)}

          {insights.length > 0 && (
            <>
              {sectionLabel('Insights')}
              {insights.map((e) => renderItem(e))}
            </>
          )}

          {sectionLabel('Settings')}
          {collapsed ? (
            settings.map((e) => renderItem(e))
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSettingsOpen((o) => !o)}
                aria-expanded={settingsOpen}
                aria-controls="sidebar-settings"
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  settingsActive && !settingsOpen ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Settings2 className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate text-left">Settings</span>
                <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', settingsOpen && 'rotate-180')} />
              </button>
              <div
                id="sidebar-settings"
                className={cn('grid transition-[grid-template-rows] duration-200', settingsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
              >
                <div className="overflow-hidden">
                  <div className="ml-5 space-y-0.5 border-l border-border pl-2">
                    {settings.map((e) => renderItem(e, { nested: true }))}
                  </div>
                </div>
              </div>
            </>
          )}
        </nav>

        <div className="space-y-1 border-t border-border pt-2">
          <div className={cn('flex items-center gap-1', collapsed ? 'flex-col' : 'px-1')}>{controls}</div>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : undefined}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {!collapsed && 'Collapse'}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              title={collapsed ? userName : undefined}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                collapsed && 'justify-center p-1.5',
              )}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="size-3.5" />
              </span>
              {!collapsed && <span className="flex-1 truncate font-medium">{userName}</span>}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right" sideOffset={8} className="w-56">
              {userMenuItems}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ── Mobile top bar (identity only; navigation is the bottom pill) ── */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/dashboard" className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-label="CatCare dashboard">
            <PawPrint className="size-4" />
          </Link>
          {household && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="max-w-40 truncate">{household.name}</span>
                <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="w-64">
                {householdMenuItems}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex items-center gap-1">
          {controls}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <User className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-56">
              {userMenuItems}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────── */}
      <div className={cn('transition-[padding] duration-200', collapsed ? 'md:pl-[72px]' : 'md:pl-62')}>
        <main className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 md:px-8 md:pb-6 lg:px-10">{children}</main>
      </div>

      {/* ── Mobile bottom pill ──────────────────────────────────── */}
      <nav
        aria-label="Primary"
        className="fixed bottom-[calc(0.875rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[min(calc(100%-2rem),26rem)] -translate-x-1/2 gap-0.5 rounded-full border border-border bg-background/90 p-1.5 shadow-lg backdrop-blur md:hidden"
      >
        {pillItems.map((e) => {
          const active = isActive(e)
          const Icon = e.lockedTier ? Lock : e.icon
          return (
            <button
              key={e.key}
              type="button"
              onClick={() => go(e)}
              aria-current={active ? 'page' : undefined}
              aria-disabled={e.lockedTier ? true : undefined}
              className={cn(
                'flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[10.5px] font-medium transition-colors',
                active ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                e.lockedTier && 'opacity-65',
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {e.label === 'Care History' ? 'History' : e.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          className={cn(
            'flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[10.5px] font-medium transition-colors',
            [...settings, insights.find((e) => e.key === 'expenses')].some((e) => e && isActive(e) && !pillItems.includes(e))
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground',
          )}
        >
          <Ellipsis className="size-5" aria-hidden="true" />
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-2xl px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="space-y-0.5">
            {insights.some((e) => e.key === 'expenses') && (
              <>
                <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Insights</p>
                {renderItem(insights.find((e) => e.key === 'expenses')!, { sheet: true })}
              </>
            )}
            <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Settings</p>
            {settings.map((e) => renderItem(e, { sheet: true }))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
