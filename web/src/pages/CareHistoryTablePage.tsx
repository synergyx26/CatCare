import { useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/EmptyState'
import { EVENT_COLORS } from '@/lib/eventColors'
import { formatEventSummary, EVENT_TYPE_LABEL } from '@/lib/helpers'
import type { CareEvent, Cat, EventType, Household, SubscriptionTier } from '@/types/api'
import { Download, Filter, Lock, RotateCcw, TableProperties, X } from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    year:   'numeric',
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

function toInputDate(d: Date): string {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Compute once at module load — these are reference defaults for "has value?" checks
const TODAY          = new Date()
const THIRTY_AGO     = new Date(TODAY); THIRTY_AGO.setDate(TODAY.getDate() - 30)
const DEFAULT_START  = toInputDate(THIRTY_AGO)
const DEFAULT_END    = toInputDate(TODAY)

function exportToCsv(events: CareEvent[], cats: Cat[], memberMap: Map<number, string>) {
  const catMap = new Map(cats.map((c) => [c.id, c.name]))
  const header = ['Date/Time', 'Cat', 'Type', 'Details', 'Notes', 'Logged by']
  const rows   = events.map((e) => [
    formatDateTime(e.occurred_at),
    catMap.get(e.cat_id) ?? String(e.cat_id),
    EVENT_TYPE_LABEL[e.event_type] ?? e.event_type,
    formatEventSummary(e),
    e.notes ?? '',
    memberMap.get(e.logged_by_id) ?? String(e.logged_by_id),
  ])
  const csvContent = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  // UTF-8 BOM so Excel/Numbers reads multi-byte chars (·, etc.) correctly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = `catcare-history-${DEFAULT_END}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ── Sub-type filter config ────────────────────────────────────────────────────

type SubtypeConfig =
  | { kind: 'select'; detailsKey: string; label: string; options: { value: string; label: string }[] }
  | { kind: 'text';   detailsKey: string; label: string }

const SUBTYPE_CONFIG: Partial<Record<EventType, SubtypeConfig>> = {
  feeding: {
    kind: 'select',
    detailsKey: 'food_type',
    label: 'Food type',
    options: [
      { value: 'wet',    label: 'Wet'    },
      { value: 'dry',    label: 'Dry'    },
      { value: 'treats', label: 'Treats' },
      { value: 'other',  label: 'Other'  },
    ],
  },
  symptom: {
    kind: 'select',
    detailsKey: 'symptom_type',
    label: 'Symptom',
    options: [
      { value: 'vomiting',      label: 'Vomiting'        },
      { value: 'coughing',      label: 'Coughing'        },
      { value: 'asthma_attack', label: 'Breathing issue' },
      { value: 'sneezing',      label: 'Sneezing'        },
      { value: 'diarrhea',      label: 'Diarrhea'        },
      { value: 'lethargy',      label: 'Lethargy'        },
      { value: 'not_eating',    label: 'Not eating'      },
      { value: 'limping',       label: 'Limping'         },
      { value: 'eye_discharge', label: 'Eye discharge'   },
      { value: 'seizure',       label: 'Seizure'         },
      { value: 'other',         label: 'Other'           },
    ],
  },
  grooming: {
    kind: 'select',
    detailsKey: 'grooming_type',
    label: 'Grooming type',
    options: [
      { value: 'bath',       label: 'Bath'       },
      { value: 'nail_trim',  label: 'Nail trim'  },
      { value: 'full_groom', label: 'Full groom' },
      { value: 'other',      label: 'Other'      },
    ],
  },
  medication: {
    kind: 'text',
    detailsKey: 'medication_name',
    label: 'Medication name',
  },
}

function applySubtypeFilter(events: CareEvent[], typeFilter: EventType | '', subtypeFilter: string): CareEvent[] {
  if (!subtypeFilter || !typeFilter) return events
  const config = SUBTYPE_CONFIG[typeFilter]
  if (!config) return events
  if (config.kind === 'select') {
    return events.filter((e) => {
      const d = e.details as Record<string, unknown>
      return d[config.detailsKey] === subtypeFilter
    })
  }
  const search = subtypeFilter.toLowerCase()
  return events.filter((e) => {
    const d = e.details as Record<string, unknown>
    return String(d[config.detailsKey] ?? '').toLowerCase().includes(search)
  })
}

// ── Small clear button reused per-filter ─────────────────────────────────────

function ClearBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <X className="size-3" />
      Clear
    </button>
  )
}

// ── All event types ───────────────────────────────────────────────────────────

const ALL_EVENT_TYPES: EventType[] = [
  'feeding', 'litter', 'water', 'weight', 'note',
  'medication', 'vet_visit', 'grooming', 'symptom', 'tooth_brushing',
]

// ── Quick range presets ───────────────────────────────────────────────────────

interface QuickRange {
  label:     string
  days:      number | null   // null = "All time"
  minTier:   SubscriptionTier
}

const QUICK_RANGES: QuickRange[] = [
  { label: '7d',       days: 7,    minTier: 'free'    },
  { label: '30d',      days: 30,   minTier: 'free'    },
  { label: '90d',      days: 90,   minTier: 'premium' },
  { label: '6 months', days: 180,  minTier: 'premium' },
  { label: 'All time', days: null, minTier: 'premium' },
]

function tierRank(tier: SubscriptionTier): number {
  return tier === 'premium' ? 2 : tier === 'pro' ? 1 : 0
}

function rangeAllowed(range: QuickRange, tier: SubscriptionTier): boolean {
  return tierRank(tier) >= tierRank(range.minTier)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CareHistoryTablePage() {
  const { householdId } = useParams<{ householdId: string }>()
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()
  const hId             = Number(householdId)
  const { user }        = useAuthStore()
  const isPremium       = user?.subscription_tier === 'premium'
  const tier            = (user?.subscription_tier ?? 'free') as SubscriptionTier

  usePageTitle('Care History')

  // Seed catFilter from ?catId= so CatHistoryPage can jump here pre-filtered
  const initialCatId = searchParams.get('catId') ? Number(searchParams.get('catId')) : ''

  const [startDate,       setStartDate]       = useState(DEFAULT_START)
  const [endDate,         setEndDate]         = useState(DEFAULT_END)
  const [catFilter,       setCatFilter]       = useState<number | ''>(initialCatId)
  const [typeFilter,      setTypeFilter]      = useState<EventType | ''>('')
  const [subtypeFilter,   setSubtypeFilter]   = useState('')
  const [memberFilter,    setMemberFilter]    = useState<number | ''>('')
  // null = custom / no quick range active; number = days value (null days = all-time)
  const [activeQuickDays, setActiveQuickDays] = useState<number | null | 'custom'>('custom')

  const subtypeConfig = typeFilter ? SUBTYPE_CONFIG[typeFilter] : undefined

  function handleTypeChange(value: EventType | '') {
    setTypeFilter(value)
    setSubtypeFilter('')
  }

  function applyQuickRange(range: QuickRange) {
    const end = new Date()
    setEndDate(toInputDate(end))
    if (range.days === null) {
      setStartDate('')   // empty start = all time
    } else {
      const start = new Date(end)
      start.setDate(end.getDate() - range.days)
      setStartDate(toInputDate(start))
    }
    setActiveQuickDays(range.days)
  }

  const hasActiveFilters =
    startDate !== DEFAULT_START ||
    endDate   !== DEFAULT_END   ||
    catFilter     !== ''        ||
    typeFilter    !== ''        ||
    subtypeFilter !== ''        ||
    memberFilter  !== ''

  function resetAllFilters() {
    setStartDate(DEFAULT_START)
    setEndDate(DEFAULT_END)
    setCatFilter('')
    setTypeFilter('')
    setSubtypeFilter('')
    setMemberFilter('')
    setActiveQuickDays('custom')
  }

  // ── Queries ───────────────────────────────────────────────────
  const { data: householdData } = useQuery({
    queryKey: ['household', hId],
    queryFn:  () => api.getHousehold(hId),
    enabled:  isPremium,
  })
  const household: Household | undefined = householdData?.data?.data

  const { data: catsData } = useQuery({
    queryKey: ['cats', hId],
    queryFn:  () => api.getCats(hId),
    enabled:  isPremium,
  })
  const cats: Cat[] = catsData?.data?.data ?? []

  const { data: eventsData, isLoading, isFetching } = useQuery({
    queryKey: ['care_events_table', hId, startDate, endDate, catFilter, typeFilter, memberFilter],
    queryFn:  () =>
      api.getCareEvents(hId, {
        startDate:  startDate  || undefined,
        endDate:    endDate    || undefined,
        catId:      catFilter    ? Number(catFilter)    : undefined,
        eventTypes: typeFilter   ? [typeFilter]          : undefined,
        loggedById: memberFilter ? Number(memberFilter)  : undefined,
      }),
    enabled:   isPremium,
    staleTime: 60_000,
  })
  const rawEvents: CareEvent[] = eventsData?.data?.data ?? []

  // Sub-type filter is client-side (details lives in JSONB — not worth a round-trip)
  const events = useMemo(
    () => applySubtypeFilter(rawEvents, typeFilter, subtypeFilter),
    [rawEvents, typeFilter, subtypeFilter]
  )

  const memberMap = useMemo(
    () => new Map<number, string>((household?.members ?? []).map((m) => [m.id, m.name])),
    [household]
  )
  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats])

  // ── Premium gate ──────────────────────────────────────────────
  if (!isPremium) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Care History"
          subtitle="Full event log with filters and export"
          backTo={{ label: 'Dashboard', onClick: () => navigate('/dashboard') }}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1 max-w-sm">
            <p className="font-semibold">Premium feature</p>
            <p className="text-sm text-muted-foreground">
              Upgrade to Premium to access the full care history table with filtering and CSV export.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <PageHeader
        title="Care History"
        subtitle={`${events.length} event${events.length !== 1 ? 's' : ''} in selected range`}
        backTo={{ label: 'Dashboard', onClick: () => navigate('/dashboard') }}
        action={
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={events.length === 0}
            onClick={() => exportToCsv(events, cats, memberMap)}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />

      {/* ── Filters ──────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">

        {/* Filter header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="size-4" />
            Filters
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="size-3" />
              Reset all
            </button>
          )}
        </div>

        {/* Quick range buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK_RANGES.map((range) => {
            const allowed  = rangeAllowed(range, tier)
            const isActive = activeQuickDays === range.days
            return (
              <button
                key={range.label}
                disabled={!allowed}
                onClick={() => allowed && applyQuickRange(range)}
                title={!allowed ? `Available on ${range.minTier} plan` : undefined}
                className={[
                  'text-xs px-2.5 py-1 rounded-full border transition-colors',
                  isActive
                    ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                    : allowed
                      ? 'bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:border-border/80 cursor-pointer'
                      : 'bg-muted/30 border-border/30 text-muted-foreground/40 cursor-not-allowed',
                ].join(' ')}
              >
                {!allowed && <Lock className="inline size-2.5 mr-1 -mt-px" />}
                {range.label}
              </button>
            )
          })}
          <span className="text-xs text-muted-foreground ml-1">or use custom dates below</span>
        </div>

        {/* Row 1: date range + cat + type + member */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">

          {/* Start date */}
          <div className="space-y-1 min-w-0">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={startDate}
              max={endDate || DEFAULT_END}
              onChange={(e) => { setStartDate(e.target.value); setActiveQuickDays('custom') }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-0 block"
            />
            <div className="h-5 flex items-center">
              {startDate !== DEFAULT_START && (
                <ClearBtn onClick={() => setStartDate(DEFAULT_START)} />
              )}
            </div>
          </div>

          {/* End date */}
          <div className="space-y-1 min-w-0">
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={DEFAULT_END}
              onChange={(e) => { setEndDate(e.target.value); setActiveQuickDays('custom') }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-0 block"
            />
            <div className="h-5 flex items-center">
              {endDate !== DEFAULT_END && (
                <ClearBtn onClick={() => setEndDate(DEFAULT_END)} />
              )}
            </div>
          </div>

          {/* Cat */}
          <div className="space-y-1 min-w-0">
            <label className="text-xs text-muted-foreground">Cat</label>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All cats</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="h-5 flex items-center">
              {catFilter !== '' && (
                <ClearBtn onClick={() => setCatFilter('')} />
              )}
            </div>
          </div>

          {/* Event type */}
          <div className="space-y-1 min-w-0">
            <label className="text-xs text-muted-foreground">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => handleTypeChange(e.target.value as EventType | '')}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All types</option>
              {ALL_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>
              ))}
            </select>
            <div className="h-5 flex items-center">
              {typeFilter !== '' && (
                <ClearBtn onClick={() => handleTypeChange('')} />
              )}
            </div>
          </div>

          {/* Logged by */}
          <div className="space-y-1 min-w-0 col-span-2 md:col-span-1">
            <label className="text-xs text-muted-foreground">Logged by</label>
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Anyone</option>
              {(household?.members ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <div className="h-5 flex items-center">
              {memberFilter !== '' && (
                <ClearBtn onClick={() => setMemberFilter('')} />
              )}
            </div>
          </div>
        </div>

        {/* Row 2: sub-type filter — only shown when selected type has sub-types */}
        {subtypeConfig && (
          <div className="pt-1 border-t border-border/40 flex items-end gap-3">
            <div className="space-y-1 w-full sm:w-56 min-w-0">
              <label className="text-xs text-muted-foreground">{subtypeConfig.label}</label>
              {subtypeConfig.kind === 'select' ? (
                <select
                  value={subtypeFilter}
                  onChange={(e) => setSubtypeFilter(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All</option>
                  {subtypeConfig.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <Input
                  value={subtypeFilter}
                  onChange={(e) => setSubtypeFilter(e.target.value)}
                  placeholder="Search by name…"
                  className="h-8 text-sm w-full"
                />
              )}
            </div>
            {subtypeFilter && (
              <ClearBtn onClick={() => setSubtypeFilter('')} />
            )}
          </div>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={TableProperties}
          title="No events found"
          description={[
            typeFilter    ? `No ${EVENT_TYPE_LABEL[typeFilter] ?? typeFilter} events` : 'No events',
            catFilter     ? ` for ${catMap.get(Number(catFilter)) ?? 'selected cat'}` : '',
            ' in this period.',
            hasActiveFilters ? ' Try adjusting your filters or date range.' : '',
          ].join('')}
        />
      ) : (
        <>
          {isFetching && <div className="h-0.5 bg-sky-500 animate-pulse rounded-full" />}

          {/* Mobile: card list */}
          <div className="sm:hidden space-y-2">
            {events.map((event) => {
              const color      = EVENT_COLORS[event.event_type]
              const catName    = catMap.get(event.cat_id) ?? '—'
              const loggerName = memberMap.get(event.logged_by_id)
                ?? (event.logged_by_id === user?.id ? 'You' : String(event.logged_by_id))
              const summary    = formatEventSummary(event)
              return (
                <div key={event.id} className="rounded-xl border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {EVENT_TYPE_LABEL[event.event_type] ?? event.event_type}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(event.occurred_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium truncate">{catName}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{loggerName}</span>
                  </div>
                  {(summary || event.notes) && (
                    <div className="text-xs text-muted-foreground space-y-0.5 border-t border-border/40 pt-2">
                      {summary && <p>{summary}</p>}
                      {event.notes && (
                        <p className="truncate" title={event.notes}>{event.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop: full table */}
          <div className="hidden sm:block rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
              <table className="min-w-[640px] w-full text-sm">
                <thead className="bg-muted/50 border-b sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Date / Time</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Cat</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Details</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Notes</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Logged by</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {events.map((event) => {
                    const color      = EVENT_COLORS[event.event_type]
                    const catName    = catMap.get(event.cat_id) ?? '—'
                    const loggerName = memberMap.get(event.logged_by_id)
                      ?? (event.logged_by_id === user?.id ? 'You' : String(event.logged_by_id))
                    return (
                      <tr key={event.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap tabular-nums text-xs">
                          {formatDateTime(event.occurred_at)}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{catName}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: `${color}20`, color }}
                          >
                            {EVENT_TYPE_LABEL[event.event_type] ?? event.event_type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatEventSummary(event) || '—'}
                        </td>
                        <td
                          className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate"
                          title={event.notes ?? undefined}
                        >
                          {event.notes || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                          {loggerName}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
