import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout'
import type { Layout, ResponsiveLayouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { api } from '@/api/client'
import { CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { Cat as CatIcon, ChevronLeft, ChevronRight, Inbox, LayoutGrid, Lock, TableProperties } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useAuthStore } from '@/store/authStore'
import type { Cat, CatStats, SubscriptionTier } from '@/types/api'
import { WeightTrendChart } from '@/components/charts/WeightTrendChart'
import { FeedingFrequencyChart } from '@/components/charts/FeedingFrequencyChart'
import { CareTypeBreakdownChart } from '@/components/charts/CareTypeBreakdownChart'
import { MemberContributionChart } from '@/components/charts/MemberContributionChart'
import { CareActivityHeatmap } from '@/components/charts/CareActivityHeatmap'
import { DailyFoodIntakeChart } from '@/components/charts/DailyFoodIntakeChart'
import { SymptomLogChart } from '@/components/charts/SymptomLogChart'
import { CalendarViewChart } from '@/components/charts/CalendarViewChart'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartSettingsSheet } from '@/components/charts/ChartSettingsSheet'
import { ExportPdfButton } from '@/components/pdf/ExportPdfButton'
import {
  DEFAULT_LAYOUTS,
  buildLayoutFromOrder,
  loadLayouts,
  saveLayouts,
  clearLayouts,
} from '@/lib/chartLayout'
import { useChartPrefsStore, normalizeChartOrder, ALL_CHART_IDS } from '@/store/chartPrefsStore'
import type { ChartId } from '@/lib/chartLayout'

type Range = '7d' | '30d' | '90d'

const RANGE_LABELS: Record<Range, string> = {
  '7d':  'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
}

const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90 }

/** Maximum offset (periods back) allowed per tier per range. */
function tierMaxOffset(tier: SubscriptionTier, range: Range): number {
  if (tier === 'premium') return Infinity
  if (tier === 'pro')     return Math.floor(180 / RANGE_DAYS[range]) - 1
  return 0 // free
}

/** Ranges the user's tier allows. Free: 7d only. Pro: 7d/30d. Premium: all. */
function tierAllowedRanges(tier: SubscriptionTier): Range[] {
  if (tier === 'premium') return ['7d', '30d', '90d']
  if (tier === 'pro')     return ['7d', '30d']
  return ['7d']
}

/** Human-readable label for the current window, e.g. "Mar 14 – Mar 20". */
function periodLabel(range: Range, offset: number): string {
  if (offset === 0) return RANGE_LABELS[range]
  const days = RANGE_DAYS[range]
  const now  = new Date()
  const end  = new Date(now); end.setDate(now.getDate() - days * offset)
  const start = new Date(now); start.setDate(now.getDate() - days * (offset + 1))
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

/** Upgrade tooltip copy tailored to the user's current tier. */
function upgradeHint(tier: SubscriptionTier): string {
  if (tier === 'pro') return 'Upgrade to Premium for unlimited history'
  return 'Upgrade to Pro or Premium to access historical data'
}

export function CatHistoryPage() {
  const { householdId, catId } = useParams<{ householdId: string; catId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const tier = (user?.subscription_tier ?? 'free') as SubscriptionTier

  // Chart preferences — globally persisted, not per-cat
  const { hidden: hiddenCharts, order: chartOrder, setOrder: setChartOrder } = useChartPrefsStore()
  const visibleCharts = useMemo<ChartId[]>(
    () => normalizeChartOrder(chartOrder).filter((id) => !hiddenCharts.includes(id)),
    [chartOrder, hiddenCharts],
  )
  const allowedRanges = useMemo(() => tierAllowedRanges(tier), [tier])
  const [range, setRange] = useState<Range>(() => {
    // Default to the widest range available for the tier
    const allowed = tierAllowedRanges(tier)
    return allowed[allowed.length - 1]
  })
  const [offset, setOffset] = useState(0)

  // If the user's tier changes (e.g. downgrade), clamp the range to what's allowed
  useEffect(() => {
    if (!allowedRanges.includes(range)) {
      setRange(allowedRanges[allowedRanges.length - 1])
      setOffset(0)
    }
  }, [allowedRanges, range])

  // Mobile detection — skip drag-and-drop grid entirely on small screens
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Layout state — initialized from localStorage, falls back to defaults
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(
    () => (catId ? loadLayouts(catId) : null) ?? DEFAULT_LAYOUTS
  )

  // Reset layout when navigating between cats
  useEffect(() => {
    setLayouts((catId ? loadLayouts(catId) : null) ?? DEFAULT_LAYOUTS)
  }, [catId])

  // When the user reorders charts in the settings panel, rebuild grid positions
  // to match the new sequence. Skip on initial mount — only fire on real changes.
  const prevChartOrderKey = useRef<string | null>(null)
  useEffect(() => {
    const key = normalizeChartOrder(chartOrder).join(',')
    if (prevChartOrderKey.current === null) {
      prevChartOrderKey.current = key
      return
    }
    if (key === prevChartOrderKey.current) return
    prevChartOrderKey.current = key

    const newLayouts = buildLayoutFromOrder(normalizeChartOrder(chartOrder))
    setLayouts(newLayouts)
    if (catId) saveLayouts(catId, newLayouts)
  }, [chartOrder, catId])

  // Proactively restore DEFAULT_LAYOUTS dimensions for any chart that is being
  // unhidden. Runs before paint (useLayoutEffect) so the chart never renders tiny.
  // This is the primary guard: if a stored layout entry has h < minH (e.g. because
  // react-grid-layout auto-placed it at h:1 in a previous session), we correct it
  // before the child mounts.
  const prevHiddenRef = useRef<ChartId[]>(hiddenCharts)
  useLayoutEffect(() => {
    const prev = prevHiddenRef.current
    const justUnhidden = prev.filter(id => !hiddenCharts.includes(id))
    prevHiddenRef.current = hiddenCharts
    if (justUnhidden.length === 0) return

    setLayouts(prev => {
      let changed = false
      const next: ResponsiveLayouts = {}
      for (const [bp, items] of Object.entries(prev)) {
        const defaultBp = (DEFAULT_LAYOUTS[bp as keyof typeof DEFAULT_LAYOUTS] ?? []) as Array<{
          i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number
        }>
        next[bp] = (items ?? []).map(item => {
          if (!justUnhidden.includes(item.i as ChartId)) return item
          const def = defaultBp.find(d => d.i === item.i)
          if (!def) return item
          // Restore default dimensions; keep stored x/y so it returns to its last position
          changed = true
          return {
            i: item.i,
            x: item.x,
            y: item.y,
            w: def.w,
            h: def.h,
            minW: def.minW,
            minH: def.minH,
          }
        })
      }
      return changed ? next : prev
    })
  }, [hiddenCharts])

  // Reset offset when range changes so we always start at the current period
  useEffect(() => { setOffset(0) }, [range])

  // useContainerWidth measures the wrapper div via ResizeObserver and gates
  // rendering on `mounted` so the grid never initialises with a wrong fallback width.
  const { width: gridWidth, containerRef, mounted: gridMounted } = useContainerWidth()

  const catQuery = useQuery({
    queryKey: ['cat', householdId, catId],
    queryFn: () => api.getCat(Number(householdId), Number(catId)),
  })

  const statsQuery = useQuery({
    queryKey: ['cat_stats', householdId, catId, range, offset],
    queryFn: () => api.getCatStats(Number(householdId), Number(catId), range, offset),
    // Historical periods never change — cache them indefinitely
    staleTime: offset === 0 ? 5 * 60 * 1000 : Infinity,
    enabled: !!householdId && !!catId,
    placeholderData: keepPreviousData,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cat: Cat | undefined = (catQuery.data as any)?.data?.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stats: CatStats | undefined = (statsQuery.data as any)?.data?.data

  usePageTitle(cat ? `${cat.name}'s History` : '')

  const latestWeight    = stats?.weight_series[stats.weight_series.length - 1]
  const feedingDays     = stats?.by_day.filter((d) => (d.types['feeding'] ?? 0) > 0).length ?? 0
  const topMember       = stats?.by_member.slice().sort((a, b) => b.count - a.count)[0]
  const hasFoodIntake   = stats?.feeding_series.some((d) => d.wet + d.dry + d.treats + d.other > 0) ?? false
  const hasSymptoms     = (stats?.symptom_series.length ?? 0) > 0
  const careTypeCount   = stats
    ? Object.values(stats.by_type).filter(v => (v ?? 0) > 0).length
    : 0

  // Enforce minimum grid cell heights for horizontal bar charts whose height is
  // driven by row count. Only ever grows a cell — never shrinks user-resized ones.
  // Must be placed after stats/careTypeCount are defined (no TDZ access in deps).
  useEffect(() => {
    if (!stats) return

    const ROW    = 60
    const MARGIN = 16
    // ChartCard overhead: accent(4px) + header(~56px) + chart padding(20px) + buffer(16px)
    const OVERHEAD = 96

    function toGridH(chartPx: number) {
      return Math.ceil((chartPx + OVERHEAD) / (ROW + MARGIN))
    }

    const breakdownH = toGridH(Math.max(120, careTypeCount * 38 + 16))
    const memberH    = toGridH(Math.max(72, stats.by_member.length * 52))

    setLayouts(prev => {
      let changed = false
      const next: ResponsiveLayouts = {}
      for (const [bp, items] of Object.entries(prev)) {
        next[bp] = (items ?? []).map(item => {
          if (item.i === 'care_breakdown' && item.h < breakdownH) {
            changed = true
            return { ...item, h: breakdownH, minH: Math.max(item.minH ?? 4, breakdownH) }
          }
          if (item.i === 'member' && item.h < memberH) {
            changed = true
            return { ...item, h: memberH, minH: Math.max(item.minH ?? 3, memberH) }
          }
          return item
        })
      }
      return changed ? next : prev
    })
  }, [stats, careTypeCount])

  // Period navigation
  const maxOffset    = tierMaxOffset(tier, range)
  const canGoNewer   = offset > 0
  const canGoOlder   = offset < maxOffset
  const atTierLimit  = !canGoOlder && tier !== 'premium'
  const currentLabel = periodLabel(range, offset)
  // For chart subtitles — use the API-provided dates once loaded, fall back to local calc
  const rangeLabel   = offset === 0
    ? RANGE_LABELS[range].toLowerCase()
    : currentLabel.toLowerCase()

  // 403 from the API means tier enforcement kicked in server-side
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isTierError  = (statsQuery.error as any)?.response?.status === 403

  // Build a lookup of default dimensions keyed by chart id, per breakpoint.
  // Used to enforce minimum sizes when react-grid-layout auto-places re-added charts.
  const defaultDimsRef = useRef<Record<string, Record<string, { h: number; w: number; minH?: number; minW?: number }>>>({})
  useEffect(() => {
    const dims: typeof defaultDimsRef.current = {}
    for (const [bp, items] of Object.entries(DEFAULT_LAYOUTS)) {
      dims[bp] = {}
      for (const item of items ?? []) {
        dims[bp][item.i] = { h: item.h, w: item.w, minH: (item as any).minH, minW: (item as any).minW }
      }
    }
    defaultDimsRef.current = dims
  }, [])

  // Merge layout changes, preserving positions for conditionally-hidden charts
  // so they snap back to the right place when data appears (e.g. weight chart).
  // Also enforces h >= minH per DEFAULT_LAYOUTS so react-grid-layout auto-placement
  // (which uses h:1) never gets persisted — the main cause of "tiny on unhide".
  const handleLayoutChange = useCallback(
    (_layout: Layout, allLayouts: ResponsiveLayouts) => {
      const merged: ResponsiveLayouts = {}
      for (const bp of Object.keys(allLayouts)) {
        const defaultBp = defaultDimsRef.current[bp] ?? {}
        const newBp = (allLayouts[bp] ?? []).map(item => {
          const def = defaultBp[item.i]
          if (!def) return item
          const minH = def.minH ?? def.h
          const minW = def.minW ?? def.w
          // If h/w are below the minimum (auto-placement artefact), restore to defaults
          if (item.h < minH || item.w < minW) {
            return { ...item, h: Math.max(item.h, minH), w: Math.max(item.w, minW), minH, minW }
          }
          // Always ensure minH/minW are stored so they survive future merges
          return { ...item, minH: (item as any).minH ?? minH, minW: (item as any).minW ?? minW }
        })
        const newKeys = new Set(newBp.map((item) => item.i))
        const preserved = (layouts[bp] ?? []).filter((item) => !newKeys.has(item.i))
        merged[bp] = [...newBp, ...preserved]
      }
      setLayouts(merged)
      if (catId) saveLayouts(catId, merged)

      // Sync settings panel order to match the new grid positions.
      // Sort lg items by y then x (top-to-bottom, left-to-right) to derive sequence.
      const lgItems = merged.lg ?? []
      const newOrder = [...lgItems]
        .sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x)
        .map(item => item.i as ChartId)
        .filter((id): id is ChartId => ALL_CHART_IDS.includes(id as ChartId))
      const currentOrderKey = normalizeChartOrder(chartOrder).join(',')
      if (newOrder.join(',') !== currentOrderKey) {
        setChartOrder(newOrder)
      }
    },
    [catId, layouts, chartOrder, setChartOrder]
  )

  const handleResetLayout = useCallback(() => {
    setLayouts(DEFAULT_LAYOUTS)
    if (catId) clearLayouts(catId)
  }, [catId])

  return (
    <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="space-y-3">

          {/* Row 1: breadcrumb + title + utility actions */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="hover:text-foreground transition-colors"
                >
                  Dashboard
                </button>
                <span className="opacity-40">/</span>
                <button
                  onClick={() => navigate(`/households/${householdId}/cats/${catId}`)}
                  className="hover:text-foreground transition-colors"
                >
                  {cat?.name ?? '...'}
                </button>
                <span className="opacity-40">/</span>
                <span className="text-foreground font-medium">Care History</span>
              </nav>

              <div className="flex items-center gap-3">
                {cat?.photo_url ? (
                  <img
                    src={cat.photo_url}
                    alt={cat.name}
                    className="w-9 h-9 rounded-xl object-cover border-2 border-sky-100 dark:border-sky-900/40"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-100 to-cyan-100 dark:from-sky-900/30 dark:to-cyan-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                    <CatIcon className="size-5" />
                  </div>
                )}
                <h1 className="text-2xl font-bold tracking-tight">
                  {cat ? `${cat.name}'s Care History` : 'Care History'}
                </h1>
              </div>
            </div>

            {/* Utility actions — export, event table, reset layout */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {cat && (
                <ExportPdfButton
                  cat={cat}
                  householdId={Number(householdId)}
                  range={range}
                  tier={tier}
                />
              )}
              {tier === 'premium' && catId && (
                <button
                  onClick={() => navigate(`/households/${householdId}/care-history?catId=${catId}`)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl ring-1 ring-border/60 bg-card hover:bg-muted/50 transition-colors"
                  title="View full event log for this cat"
                >
                  <TableProperties className="size-3.5" />
                  <span className="hidden sm:inline">Event table</span>
                </button>
              )}
              <ChartSettingsSheet />
              {!isMobile && (
                <button
                  onClick={handleResetLayout}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl ring-1 ring-border/60 bg-card hover:bg-muted/50 transition-colors"
                  title="Reset chart layout to default"
                >
                  <LayoutGrid className="size-3.5" />
                  <span className="hidden sm:inline">Reset layout</span>
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Filter bar — container-responsive via @container */}
          <div className="@container">
            <div className="flex flex-col @md:flex-row @md:items-center gap-2">

              {/* Range selector — grid on narrow, inline flex on wider */}
              <div className="grid grid-cols-3 @md:flex rounded-xl overflow-hidden ring-1 ring-border/60 text-sm">
                {(['7d', '30d', '90d'] as Range[]).map((r) => {
                  const allowed = allowedRanges.includes(r)
                  return (
                    <button
                      key={r}
                      onClick={() => allowed && setRange(r)}
                      disabled={!allowed}
                      title={!allowed ? upgradeHint(tier) : undefined}
                      className={[
                        'flex items-center justify-center gap-1.5 px-3 py-2.5 font-medium transition-colors',
                        range === r
                          ? 'bg-sky-500 text-white'
                          : allowed
                            ? 'bg-card text-muted-foreground hover:text-foreground hover:bg-sky-50 dark:hover:bg-sky-950/20'
                            : 'bg-card text-muted-foreground/40 cursor-not-allowed',
                      ].join(' ')}
                    >
                      {!allowed && <Lock className="size-2.5 shrink-0" />}
                      {r}
                    </button>
                  )
                })}
              </div>

              {/* Period navigator — full width on narrow, auto on wider */}
              <div className="flex items-center rounded-xl ring-1 ring-border/60 bg-card overflow-hidden text-sm">
                {/* Older */}
                <button
                  onClick={() => setOffset((o) => o + 1)}
                  disabled={!canGoOlder}
                  title={atTierLimit ? upgradeHint(tier) : 'Previous period'}
                  className={[
                    'flex items-center justify-center w-9 h-10 flex-none transition-colors',
                    canGoOlder
                      ? 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      : atTierLimit
                        ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-not-allowed'
                        : 'text-muted-foreground/30 cursor-not-allowed',
                  ].join(' ')}
                >
                  {atTierLimit
                    ? <Lock className="size-3.5" />
                    : <ChevronLeft className="size-4" />
                  }
                </button>

                {/* Current window label */}
                <div className="flex flex-col items-center justify-center px-2 py-1.5 flex-1 min-w-0 overflow-hidden">
                  <span className="text-xs font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                    {currentLabel}
                  </span>
                  {offset > 0 && (
                    <button
                      onClick={() => setOffset(0)}
                      className="text-[10px] text-sky-500 hover:text-sky-600 dark:hover:text-sky-400 font-medium mt-0.5 leading-none transition-colors"
                    >
                      Back to today
                    </button>
                  )}
                </div>

                {/* Newer */}
                <button
                  onClick={() => setOffset((o) => o - 1)}
                  disabled={!canGoNewer}
                  title={canGoNewer ? 'Next period' : 'Already at current period'}
                  className={[
                    'flex items-center justify-center w-9 h-10 flex-none transition-colors',
                    canGoNewer
                      ? 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      : 'text-muted-foreground/30 cursor-not-allowed',
                  ].join(' ')}
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* ── Summary cards ───────────────────────────────────────────────── */}
        {statsQuery.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] rounded-2xl" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Total Events"
              value={String(stats.total_events)}
              sub={currentLabel}
              color="sky"
            />
            <StatCard
              label="Feeding Days"
              value={`${feedingDays} / ${stats.by_day.length}`}
              sub="days with feeding"
              color="amber"
            />
            <StatCard
              label="Latest Weight"
              value={latestWeight ? `${latestWeight.value} ${latestWeight.unit}` : '\u2014'}
              sub={
                latestWeight
                  ? new Date(latestWeight.occurred_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric',
                    })
                  : 'not logged'
              }
              color="emerald"
            />
            <StatCard
              label="Top Contributor"
              value={topMember?.name ?? '\u2014'}
              sub={topMember ? `${topMember.count} events` : undefined}
              color="purple"
            />
          </div>
        ) : null}

        {/* ── Chart skeletons ─────────────────────────────────────────────── */}
        {statsQuery.isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        )}

        {/* ── Tier limit error ────────────────────────────────────────────── */}
        {isTierError && (
          <EmptyState
            icon={Lock}
            title="History not available on your plan"
            description={upgradeHint(tier)}
          />
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!isTierError && stats && stats.total_events === 0 && (
          <EmptyState
            icon={Inbox}
            title="No events in this period"
            description="Try selecting a longer range, or log some care events first."
          />
        )}

        {/* ── Charts ───────────────────────────────────────────────────────── */}
        {!isTierError && stats && stats.total_events > 0 && (
          <div className="w-full min-w-0 relative">
            {statsQuery.isFetching && (
              <div className="absolute inset-0 z-10 bg-background/40 rounded-2xl pointer-events-none animate-pulse" />
            )}

            {/* Mobile: plain vertical stack — no drag/drop, no pixel-width grid */}
            {isMobile && (
              <div className="flex flex-col gap-4">
                {visibleCharts.map((id) => {
                  switch (id) {
                    case 'weight':
                      return stats.weight_series.length > 0 ? (
                        <div key={id} className="h-[240px]">
                          <ChartCard className="h-full" title="Weight over time" subtitle={`${stats.weight_series.length} entr${stats.weight_series.length === 1 ? 'y' : 'ies'} \u00B7 ${rangeLabel}`} accent="linear-gradient(to right, #34d399, #4ade80)">
                            <WeightTrendChart data={stats.weight_series} />
                          </ChartCard>
                        </div>
                      ) : null
                    case 'feeding':
                      return (
                        <div key={id} className="h-[220px]">
                          <ChartCard className="h-full" title="Feeding frequency" subtitle="Feedings per day" accent="linear-gradient(to right, #fbbf24, #fb923c)">
                            <FeedingFrequencyChart data={stats.by_day} />
                          </ChartCard>
                        </div>
                      )
                    case 'care_breakdown':
                      return (
                        <div key={id} style={{ height: Math.max(200, careTypeCount * 38 + 16 + 96) }}>
                          <ChartCard className="h-full" title="Care breakdown" subtitle={`By type \u00B7 ${rangeLabel}`} accent="linear-gradient(to right, #38bdf8, #60a5fa)">
                            <CareTypeBreakdownChart byType={stats.by_type} />
                          </ChartCard>
                        </div>
                      )
                    case 'member':
                      return stats.by_member.length > 0 ? (
                        <div key={id} style={{ height: Math.max(200, stats.by_member.length * 52 + 110) }}>
                          <ChartCard className="h-full" title="Household contributions" subtitle="Events logged per member" accent="linear-gradient(to right, #c084fc, #a78bfa)">
                            <MemberContributionChart data={stats.by_member} />
                          </ChartCard>
                        </div>
                      ) : null
                    case 'heatmap':
                      return (
                        <div key={id} className="h-[280px]">
                          <ChartCard className="h-full" title="Activity heatmap" subtitle="Care events by day" accent="linear-gradient(to right, #22d3ee, #38bdf8)">
                            <CareActivityHeatmap data={stats.by_day} />
                          </ChartCard>
                        </div>
                      )
                    case 'food_intake':
                      return hasFoodIntake ? (
                        <div key={id} className="h-[300px]">
                          <ChartCard className="h-full" title="Daily food intake" subtitle="Grams per food type" accent="linear-gradient(to right, #fb923c, #fbbf24)">
                            <DailyFoodIntakeChart data={stats.feeding_series} />
                          </ChartCard>
                        </div>
                      ) : null
                    case 'symptom_log':
                      return hasSymptoms ? (
                        <div key={id} className="h-[280px]">
                          <ChartCard className="h-full" title="Symptom log" subtitle={`${stats.symptom_series.length} event${stats.symptom_series.length === 1 ? '' : 's'} \u00B7 ${rangeLabel}`} accent="linear-gradient(to right, #f97316, #ef4444)">
                            <SymptomLogChart data={stats.symptom_series} />
                          </ChartCard>
                        </div>
                      ) : null
                    case 'calendar':
                      return (
                        <div key={id} className="h-[480px]">
                          <ChartCard className="h-full" title="Care calendar" subtitle={rangeLabel} accent="linear-gradient(to right, #38bdf8, #818cf8)">
                            <CalendarViewChart data={stats.by_day} startDate={stats.start_date} endDate={stats.end_date} tier={tier} feedingsPerDay={cat?.feedings_per_day ?? 0} />
                          </ChartCard>
                        </div>
                      )
                    default:
                      return null
                  }
                })}
              </div>
            )}

            {/* Desktop: drag-and-drop + resizable grid */}
            {!isMobile && (
              <div ref={containerRef as any} className="w-full">
                {gridMounted && <ResponsiveGridLayout
                  width={gridWidth}
                  className="layout"
                  layouts={layouts}
                  breakpoints={{ lg: 768, sm: 0 }}
                  cols={{ lg: 12, sm: 12 }}
                  rowHeight={60}
                  dragConfig={{ handle: '.drag-handle' }}
                  resizeConfig={{ handles: ['se'] }}
                  onLayoutChange={handleLayoutChange}
                  margin={[16, 16]}
                  containerPadding={[0, 0]}
                >
                  {visibleCharts.includes('weight') && (
                    <ChartCard
                      key="weight"
                      title="Weight over time"
                      subtitle={
                        stats.weight_series.length > 0
                          ? `${stats.weight_series.length} entr${stats.weight_series.length === 1 ? 'y' : 'ies'} \u00B7 ${rangeLabel}`
                          : `No weight data \u00B7 ${rangeLabel}`
                      }
                      accent="linear-gradient(to right, #34d399, #4ade80)"
                    >
                      {stats.weight_series.length > 0
                        ? <WeightTrendChart data={stats.weight_series} />
                        : <ChartEmptyState message="No weight events in this period" />
                      }
                    </ChartCard>
                  )}
                  {visibleCharts.includes('feeding') && (
                    <ChartCard
                      key="feeding"
                      title="Feeding frequency"
                      subtitle="Feedings per day"
                      accent="linear-gradient(to right, #fbbf24, #fb923c)"
                    >
                      <FeedingFrequencyChart data={stats.by_day} />
                    </ChartCard>
                  )}
                  {visibleCharts.includes('care_breakdown') && (
                    <ChartCard
                      key="care_breakdown"
                      title="Care breakdown"
                      subtitle={`By type \u00B7 ${rangeLabel}`}
                      accent="linear-gradient(to right, #38bdf8, #60a5fa)"
                    >
                      <CareTypeBreakdownChart byType={stats.by_type} />
                    </ChartCard>
                  )}
                  {visibleCharts.includes('member') && (
                    <ChartCard
                      key="member"
                      title="Household contributions"
                      subtitle="Events logged per member"
                      accent="linear-gradient(to right, #c084fc, #a78bfa)"
                    >
                      {stats.by_member.length > 0
                        ? <MemberContributionChart data={stats.by_member} />
                        : <ChartEmptyState message="No member data in this period" />
                      }
                    </ChartCard>
                  )}
                  {visibleCharts.includes('heatmap') && (
                    <ChartCard
                      key="heatmap"
                      title="Activity heatmap"
                      subtitle="Care events by day"
                      accent="linear-gradient(to right, #22d3ee, #38bdf8)"
                    >
                      <CareActivityHeatmap data={stats.by_day} />
                    </ChartCard>
                  )}
                  {visibleCharts.includes('food_intake') && (
                    <ChartCard
                      key="food_intake"
                      title="Daily food intake"
                      subtitle="Grams per food type"
                      accent="linear-gradient(to right, #fb923c, #fbbf24)"
                    >
                      {hasFoodIntake
                        ? <DailyFoodIntakeChart data={stats.feeding_series} />
                        : <ChartEmptyState message="No food intake data in this period" />
                      }
                    </ChartCard>
                  )}
                  {visibleCharts.includes('symptom_log') && (
                    <ChartCard
                      key="symptom_log"
                      title="Symptom log"
                      subtitle={
                        hasSymptoms
                          ? `${stats.symptom_series.length} event${stats.symptom_series.length === 1 ? '' : 's'} · ${rangeLabel}`
                          : `No symptoms logged · ${rangeLabel}`
                      }
                      accent="linear-gradient(to right, #f97316, #ef4444)"
                    >
                      {hasSymptoms
                        ? <SymptomLogChart data={stats.symptom_series} />
                        : <ChartEmptyState message="No symptoms logged in this period" />
                      }
                    </ChartCard>
                  )}
                  {visibleCharts.includes('calendar') && (
                    <ChartCard
                      key="calendar"
                      title="Care calendar"
                      subtitle={rangeLabel}
                      accent="linear-gradient(to right, #38bdf8, #818cf8)"
                    >
                      <CalendarViewChart
                        data={stats.by_day}
                        startDate={stats.start_date}
                        endDate={stats.end_date}
                        tier={tier}
                        feedingsPerDay={cat?.feedings_per_day ?? 0}
                      />
                    </ChartCard>
                  )}
                </ResponsiveGridLayout>}
              </div>
            )}
          </div>
        )}

    </div>
  )
}

// ── Local helper components ───────────────────────────────────────────────────

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

const STAT_COLORS: Record<string, string> = {
  sky:     'from-sky-50 to-cyan-50 dark:from-sky-950/20 dark:to-cyan-950/20 ring-sky-200/50 dark:ring-sky-800/30',
  amber:   'from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 ring-amber-200/50 dark:ring-amber-800/30',
  emerald: 'from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 ring-emerald-200/50 dark:ring-emerald-800/30',
  purple:  'from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 ring-purple-200/50 dark:ring-purple-800/30',
}

function StatCard({ label, value, sub, color = 'sky' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${STAT_COLORS[color] ?? STAT_COLORS.sky} ring-1 shadow-sm`}>
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest truncate">
          {label}
        </p>
        <p className="text-xl font-bold text-foreground mt-1 truncate">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </CardContent>
    </div>
  )
}
