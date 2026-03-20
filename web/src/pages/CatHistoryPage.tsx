import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { ResponsiveGridLayout } from 'react-grid-layout'
import type { Layout, ResponsiveLayouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { api } from '@/api/client'
import { CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { Cat as CatIcon, Inbox, LayoutGrid } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { Cat, CatStats } from '@/types/api'
import { WeightTrendChart } from '@/components/charts/WeightTrendChart'
import { FeedingFrequencyChart } from '@/components/charts/FeedingFrequencyChart'
import { CareTypeBreakdownChart } from '@/components/charts/CareTypeBreakdownChart'
import { MemberContributionChart } from '@/components/charts/MemberContributionChart'
import { CareActivityHeatmap } from '@/components/charts/CareActivityHeatmap'
import { ChartCard } from '@/components/charts/ChartCard'
import {
  DEFAULT_LAYOUTS,
  loadLayouts,
  saveLayouts,
  clearLayouts,
} from '@/lib/chartLayout'

type Range = '7d' | '30d' | '90d'

const RANGE_LABELS: Record<Range, string> = {
  '7d':  'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
}

export function CatHistoryPage() {
  const { householdId, catId } = useParams<{ householdId: string; catId: string }>()
  const navigate = useNavigate()
  const [range, setRange] = useState<Range>('30d')

  // Layout state — initialized from localStorage, falls back to defaults
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(
    () => (catId ? loadLayouts(catId) : null) ?? DEFAULT_LAYOUTS
  )

  // Reset layout when navigating between cats
  useEffect(() => {
    setLayouts((catId ? loadLayouts(catId) : null) ?? DEFAULT_LAYOUTS)
  }, [catId])

  // Measure container width using our own ResizeObserver — useContainerWidth() from
  // react-grid-layout uses a viewport-level fallback that ignores max-w constraints.
  const containerRef = useRef<HTMLDivElement>(null)
  const [gridWidth, setGridWidth] = useState(0)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setGridWidth(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([entry]) => setGridWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const catQuery = useQuery({
    queryKey: ['cat', householdId, catId],
    queryFn: () => api.getCat(Number(householdId), Number(catId)),
  })

  const statsQuery = useQuery({
    queryKey: ['cat_stats', householdId, catId, range],
    queryFn: () => api.getCatStats(Number(householdId), Number(catId), range),
    staleTime: 5 * 60 * 1000,
    enabled: !!householdId && !!catId,
    placeholderData: keepPreviousData,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cat: Cat | undefined = (catQuery.data as any)?.data?.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stats: CatStats | undefined = (statsQuery.data as any)?.data?.data

  usePageTitle(cat ? `${cat.name}'s History` : '')

  const latestWeight = stats?.weight_series[stats.weight_series.length - 1]
  const feedingDays  = stats?.by_day.filter((d) => (d.types['feeding'] ?? 0) > 0).length ?? 0
  const topMember    = stats?.by_member.slice().sort((a, b) => b.count - a.count)[0]

  // Merge layout changes, preserving positions for conditionally-hidden charts
  // so they snap back to the right place when data appears (e.g. weight chart)
  const handleLayoutChange = useCallback(
    (_layout: Layout, allLayouts: ResponsiveLayouts) => {
      const merged: ResponsiveLayouts = {}
      for (const bp of Object.keys(allLayouts)) {
        const newBp = allLayouts[bp] ?? []
        const newKeys = new Set(newBp.map((item) => item.i))
        const preserved = (layouts[bp] ?? []).filter((item) => !newKeys.has(item.i))
        merged[bp] = [...newBp, ...preserved]
      }
      setLayouts(merged)
      if (catId) saveLayouts(catId, merged)
    },
    [catId, layouts]
  )

  const handleResetLayout = useCallback(() => {
    setLayouts(DEFAULT_LAYOUTS)
    if (catId) clearLayouts(catId)
  }, [catId])

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
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

          {/* Controls: range selector + reset layout */}
          <div className="flex items-center gap-2 sm:shrink-0 flex-wrap">
            <button
              onClick={handleResetLayout}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl ring-1 ring-border/60 bg-card hover:bg-muted/50 transition-colors"
              title="Reset chart layout to default"
            >
              <LayoutGrid className="size-3.5" />
              Reset layout
            </button>
            <div className="flex rounded-xl overflow-hidden ring-1 ring-border/60 text-sm">
              {(['7d', '30d', '90d'] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={[
                    'px-4 py-2 font-medium transition-colors',
                    range === r
                      ? 'bg-sky-500 text-white'
                      : 'bg-card text-muted-foreground hover:text-foreground hover:bg-sky-50 dark:hover:bg-sky-950/20',
                  ].join(' ')}
                >
                  {r}
                </button>
              ))}
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
              sub={RANGE_LABELS[range]}
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

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {stats && stats.total_events === 0 && (
          <EmptyState
            icon={Inbox}
            title="No events in this period"
            description="Try selecting a longer range, or log some care events first."
          />
        )}

        {/* ── Charts (drag-and-drop + resizable grid) ──────────────────────── */}
        {stats && stats.total_events > 0 && (
          <div ref={containerRef} className="w-full min-w-0 relative">
          {statsQuery.isFetching && (
            <div className="absolute inset-0 z-10 bg-background/50 rounded-2xl pointer-events-none transition-opacity" />
          )}
          <ResponsiveGridLayout
            width={gridWidth || 800}
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
            {stats.weight_series.length > 0 && (
              <ChartCard
                key="weight"
                title="Weight over time"
                subtitle={`${stats.weight_series.length} entr${stats.weight_series.length === 1 ? 'y' : 'ies'} \u00B7 ${RANGE_LABELS[range].toLowerCase()}`}
                accent="linear-gradient(to right, #34d399, #4ade80)"
              >
                <WeightTrendChart data={stats.weight_series} />
              </ChartCard>
            )}

            <ChartCard
              key="feeding"
              title="Feeding frequency"
              subtitle="Feedings per day"
              accent="linear-gradient(to right, #fbbf24, #fb923c)"
            >
              <FeedingFrequencyChart data={stats.by_day} />
            </ChartCard>

            <ChartCard
              key="care_breakdown"
              title="Care breakdown"
              subtitle={`By type \u00B7 ${RANGE_LABELS[range].toLowerCase()}`}
              accent="linear-gradient(to right, #38bdf8, #60a5fa)"
            >
              <CareTypeBreakdownChart byType={stats.by_type} />
            </ChartCard>

            {stats.by_member.length > 0 && (
              <ChartCard
                key="member"
                title="Household contributions"
                subtitle="Events logged per member"
                accent="linear-gradient(to right, #c084fc, #a78bfa)"
              >
                <MemberContributionChart data={stats.by_member} />
              </ChartCard>
            )}

            <ChartCard
              key="heatmap"
              title="Activity heatmap"
              subtitle="Care events by day"
              accent="linear-gradient(to right, #22d3ee, #38bdf8)"
            >
              <CareActivityHeatmap data={stats.by_day} />
            </ChartCard>
          </ResponsiveGridLayout>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Local helper components ───────────────────────────────────────────────────

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
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest truncate">
          {label}
        </p>
        <p className="text-xl font-bold text-foreground mt-1 truncate">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </CardContent>
    </div>
  )
}
