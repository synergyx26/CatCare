import { useState } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { googleLogout } from '@react-oauth/google'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { api } from '@/api/client'
import type { SubscriptionTier } from '@/types/api'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/types/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  PawPrint,
  Menu,
  Home,
  Settings2,
  Lock,
  LogOut,
  User,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  ShieldCheck,
  Bell,
  TableProperties,
  CalendarDays,
  Plane,
  ReceiptText,
} from 'lucide-react'
import { useThemeStore, type Theme } from '@/store/themeStore'
import type { Household } from '@/types/api'

const THEME_CYCLE: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' }
const THEME_ICON: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor }

const TIERS: SubscriptionTier[] = ['free', 'pro', 'premium']
const TIER_LABELS: Record<SubscriptionTier, string> = { free: 'Free', pro: 'Pro', premium: 'Premium' }

function TierBadge({ tier }: { tier: 'pro' | 'premium' }) {
  return (
    <span className={[
      'ml-auto text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0',
      tier === 'premium'
        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
        : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    ].join(' ')}>
      {tier}
    </span>
  )
}

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clearAuth, setAuth } = useAuthStore()
  const { setPreferences } = useNotificationStore()
  const queryClient = useQueryClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [tierSwitching, setTierSwitching] = useState(false)
  const { theme, setTheme } = useThemeStore()

  // Re-fetch /me on every app load so DB changes (e.g. tier updates) are picked up
  // without requiring the user to log out and back in.
  useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.me()
      const fresh = (res as any)?.data?.data
      if (fresh && user) {
        setAuth(fresh, localStorage.getItem('catcare_token') ?? '')
        setPreferences(fresh.notification_preferences ?? DEFAULT_NOTIFICATION_PREFERENCES)
      }
      return fresh
    },
    staleTime: 60_000,
    enabled: !!user,
  })

  async function handleTierSwitch(tier: SubscriptionTier) {
    if (!user || tierSwitching) return
    setTierSwitching(true)
    try {
      await api.updateSubscriptionTier(tier)
      // Update the store so all tier-gated UI reacts immediately
      setAuth({ ...user, subscription_tier: tier }, localStorage.getItem('catcare_token') ?? '')
      queryClient.invalidateQueries({ queryKey: ['cat_stats'] })
    } finally {
      setTierSwitching(false)
    }
  }

  const { data: householdsData } = useQuery({
    queryKey: ['households'],
    queryFn: () => api.getHouseholds(),
  })
  const households: Household[] = householdsData?.data?.data ?? []
  const primaryHousehold = households[0]
  const currentRole = primaryHousehold?.members?.find((m) => m.id === user?.id)?.role ?? null
  const tier = user?.subscription_tier ?? 'free'
  const canAccessCalendar    = tier === 'pro' || tier === 'premium'
  const canAccessCareHistory = tier === 'premium'
  const canAccessExpenses    = tier === 'premium'

  function handleLogout() {
    // Clear client state immediately so the user is logged out regardless of
    // network conditions. Server-side JTI rotation is best-effort in the background.
    clearAuth()
    queryClient.clear()
    googleLogout()
    navigate('/login', { replace: true })
    api.logout().catch(() => {})
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/50 to-background dark:from-sky-950/10 dark:to-background">
      {/* ── Sticky top navbar ───────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-border dark:bg-background/90">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: logo + household name */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon-sm" className="sm:hidden" />
                }
              >
                <Menu className="size-5" />
                <span className="sr-only">Open menu</span>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <PawPrint className="size-5 text-primary" />
                    CatCare
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-2" aria-label="Main navigation">
                  <button
                    onClick={() => {
                      navigate('/dashboard')
                      setMobileOpen(false)
                    }}
                    aria-current={location.pathname === '/dashboard' ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors ${
                      location.pathname === '/dashboard' ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300' : ''
                    }`}
                  >
                    <Home className="size-4" aria-hidden="true" />
                    Dashboard
                  </button>
                  {/* Insights section — always visible; locked items show tier badge */}
                  {primaryHousehold && (
                    <>
                      <div className="px-3 pt-3 pb-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Insights</p>
                      </div>
                      <button
                        onClick={canAccessCalendar ? () => { navigate(`/households/${primaryHousehold.id}/calendar`); setMobileOpen(false) } : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full ${
                          canAccessCalendar
                            ? 'hover:bg-muted text-foreground'
                            : 'text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        {canAccessCalendar ? <CalendarDays className="size-4 shrink-0" /> : <Lock className="size-4 shrink-0" />}
                        Calendar
                        {!canAccessCalendar && <TierBadge tier="pro" />}
                      </button>
                      <button
                        onClick={canAccessCareHistory ? () => { navigate(`/households/${primaryHousehold.id}/care-history`); setMobileOpen(false) } : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full ${
                          canAccessCareHistory
                            ? 'hover:bg-muted text-foreground'
                            : 'text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        {canAccessCareHistory ? <TableProperties className="size-4 shrink-0" /> : <Lock className="size-4 shrink-0" />}
                        Care History
                        {!canAccessCareHistory && <TierBadge tier="premium" />}
                      </button>
                      <button
                        onClick={canAccessExpenses && primaryHousehold
                          ? () => { navigate(`/households/${primaryHousehold.id}/expenses`); setMobileOpen(false) }
                          : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full ${
                          canAccessExpenses
                            ? 'hover:bg-muted text-foreground'
                            : 'text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        {canAccessExpenses ? <ReceiptText className="size-4 shrink-0" /> : <Lock className="size-4 shrink-0" />}
                        Expenses
                        {!canAccessExpenses && <TierBadge tier="premium" />}
                      </button>
                    </>
                  )}

                  {/* Settings group */}
                  <div className="px-3 pt-3 pb-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Settings</p>
                  </div>
                  {primaryHousehold && (
                    <button
                      onClick={() => {
                        navigate(`/households/${primaryHousehold.id}/profile`)
                        setMobileOpen(false)
                      }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <User className="size-4" />
                      Household
                    </button>
                  )}
                  {primaryHousehold && currentRole === 'admin' && (
                    <button
                      onClick={() => {
                        navigate(`/households/${primaryHousehold.id}/settings`)
                        setMobileOpen(false)
                      }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Settings2 className="size-4" />
                      Care
                    </button>
                  )}
                  {primaryHousehold && currentRole === 'admin' && (
                    <button
                      onClick={() => {
                        navigate(`/households/${primaryHousehold.id}/vacation`)
                        setMobileOpen(false)
                      }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Plane className="size-4" />
                      Vacation Mode
                      {primaryHousehold.active_vacation_trip && (
                        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                          active
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      navigate('/notification-settings')
                      setMobileOpen(false)
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Bell className="size-4" />
                    Notifications
                  </button>
                  {user?.is_super_admin && (
                    <>
                      <button
                        onClick={() => {
                          navigate('/admin')
                          setMobileOpen(false)
                        }}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                      >
                        <ShieldCheck className="size-4 shrink-0" />
                        Admin Dashboard
                        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          dev
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          navigate('/admin/import')
                          setMobileOpen(false)
                        }}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                      >
                        <ShieldCheck className="size-4 shrink-0" />
                        Import Data
                        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          dev
                        </span>
                      </button>
                    </>
                  )}
                </nav>
                <div className="mt-auto border-t px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{user?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full justify-start gap-2 text-muted-foreground"
                    onClick={() => {
                      setMobileOpen(false)
                      handleLogout()
                    }}
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <Link
              to="/dashboard"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <div className="flex size-7 items-center justify-center rounded-lg bg-sky-500 text-white">
                <PawPrint className="size-4" />
              </div>
              <span className="hidden sm:inline bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-transparent dark:from-sky-400 dark:to-cyan-400">CatCare</span>
            </Link>

            {/* Household name */}
            {primaryHousehold && (
              <>
                <span className="hidden text-muted-foreground sm:inline">/</span>
                <span className="hidden text-sm font-medium sm:inline">
                  {primaryHousehold.name}
                </span>
              </>
            )}
          </div>

          {/* Right: desktop nav + user menu */}
          <div className="flex items-center gap-2">
            {/* Desktop nav links */}
            <nav className="mr-2 hidden items-center gap-1 sm:flex" aria-label="Main navigation">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                aria-current={location.pathname === '/dashboard' ? 'page' : undefined}
                className={location.pathname === '/dashboard' ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300' : ''}
              >
                Dashboard
              </Button>

              {/* Settings dropdown — consolidates Household, Care, and Notification settings */}
              {primaryHousehold && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1')}
                  >
                    Settings
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8} className="min-w-44">
                    <DropdownMenuItem onClick={() => navigate(`/households/${primaryHousehold.id}/profile`)}>
                      <User className="size-4" />
                      Household
                    </DropdownMenuItem>
                    {currentRole === 'admin' && (
                      <DropdownMenuItem onClick={() => navigate(`/households/${primaryHousehold.id}/settings`)}>
                        <Settings2 className="size-4" />
                        Care
                      </DropdownMenuItem>
                    )}
                    {currentRole === 'admin' && (
                      <DropdownMenuItem onClick={() => navigate(`/households/${primaryHousehold.id}/vacation`)}>
                        <Plane className="size-4" />
                        Vacation Mode
                        {primaryHousehold.active_vacation_trip && (
                          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                            active
                          </span>
                        )}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate('/notification-settings')}>
                      <Bell className="size-4" />
                      Notifications
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Insights dropdown — Calendar + Care History, always visible with lock state */}
              {primaryHousehold && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1')}
                  >
                    Insights
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8} className="min-w-52">
                    <DropdownMenuItem
                      onClick={canAccessCalendar ? () => navigate(`/households/${primaryHousehold.id}/calendar`) : undefined}
                      className={!canAccessCalendar ? 'opacity-60 cursor-not-allowed' : ''}
                    >
                      {canAccessCalendar ? <CalendarDays className="size-4" /> : <Lock className="size-4" />}
                      Calendar
                      {!canAccessCalendar && <TierBadge tier="pro" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={canAccessCareHistory ? () => navigate(`/households/${primaryHousehold.id}/care-history`) : undefined}
                      className={!canAccessCareHistory ? 'opacity-60 cursor-not-allowed' : ''}
                    >
                      {canAccessCareHistory ? <TableProperties className="size-4" /> : <Lock className="size-4" />}
                      Care History
                      {!canAccessCareHistory && <TierBadge tier="premium" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={canAccessExpenses ? () => navigate(`/households/${primaryHousehold.id}/expenses`) : undefined}
                      className={!canAccessExpenses ? 'opacity-60 cursor-not-allowed' : ''}
                    >
                      {canAccessExpenses ? <ReceiptText className="size-4" /> : <Lock className="size-4" />}
                      Expenses
                      {!canAccessExpenses && <TierBadge tier="premium" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </nav>

            {/* Theme toggle */}
            {(() => {
              const ThemeIcon = THEME_ICON[theme]
              const nextTheme = THEME_CYCLE[theme]
              const themeLabel = `Switch to ${nextTheme} mode (currently ${theme})`
              return (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setTheme(nextTheme)}
                  aria-label={themeLabel}
                  title={themeLabel}
                >
                  <ThemeIcon className="size-4" aria-hidden="true" />
                </Button>
              )
            })()}

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
              >
                <div className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="size-3" />
                </div>
                <span className="hidden text-xs sm:inline">{user?.name}</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="min-w-52 w-auto">
                <div className="px-1.5 py-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{user?.name}</p>
                    {user?.subscription_tier && (
                      <span className={[
                        'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full',
                        user.subscription_tier === 'premium'
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                          : user.subscription_tier === 'pro'
                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                            : 'bg-muted text-muted-foreground',
                      ].join(' ')}>
                        {user.subscription_tier}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                {user?.is_super_admin && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                        <ShieldCheck className="size-3" />
                        Dev tier
                      </div>
                      <div className="flex gap-1 mb-2">
                        {TIERS.map((t) => (
                          <button
                            key={t}
                            disabled={tierSwitching || user.subscription_tier === t}
                            onClick={() => handleTierSwitch(t)}
                            className={[
                              'flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                              user.subscription_tier === t
                                ? 'bg-sky-500 text-white cursor-default'
                                : 'bg-muted text-muted-foreground hover:bg-sky-100 hover:text-sky-700 dark:hover:bg-sky-950/40 dark:hover:text-sky-300',
                              tierSwitching ? 'opacity-50' : '',
                            ].join(' ')}
                          >
                            {TIER_LABELS[t]}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => navigate('/admin')}
                        className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                      >
                        <ShieldCheck className="size-3 shrink-0" />
                        Admin Dashboard
                      </button>
                      <button
                        onClick={() => navigate('/admin/import')}
                        className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                      >
                        <ShieldCheck className="size-3 shrink-0" />
                        Import Data
                      </button>
                    </div>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 lg:px-10 py-6">
        <Outlet />
      </main>
    </div>
  )
}
