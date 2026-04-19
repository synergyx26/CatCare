import { useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { useEffectiveTier } from '@/hooks/useEffectiveTier'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/EmptyState'
import { EVENT_COLORS } from '@/lib/eventColors'
import { formatEventSummary, EVENT_TYPE_LABEL } from '@/lib/helpers'
import type { CareEvent, Cat, EventType, Household, HouseholdChore, HouseholdChoreDefinition, SubscriptionTier } from '@/types/api'
import { Download, Filter, Home, Lock, RotateCcw, TableProperties, X } from 'lucide-react'

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

// ── Unified row type ─────────────────────────────────────────────────────────

type UnifiedRow =
  | { kind: 'event'; data: CareEvent }
  | { kind: 'chore'; data: HouseholdChore }

const CHORE_COLOR = '#6366f1' // indigo-500

// ── TypeFilter extended to include chores ────────────────────────────────────

type TypeFilterValue = EventType | '' | 'chore'

// ── CSV export ───────────────────────────────────────────────────────────────

function exportToCsv(
  rows: UnifiedRow[],
  cats: Cat[],
  memberMap: Map<number, string>,
  definitionMap: Map<number, HouseholdChoreDefinition>,
) {
  const catMap = new Map(cats.map((c) => [c.id, c.name]))
  const header = ['Date/Time', 'Cat / Source', 'Type', 'Details', 'Notes', 'Logged by']
  const csvRows = rows.map((row) => {
    if (row.kind === 'event') {
      const e = row.data
      return [
        formatDateTime(e.occurred_at),
        catMap.get(e.cat_id) ?? String(e.cat_id),
        EVENT_TYPE_LABEL[e.event_type] ?? e.event_type,
        formatEventSummary(e),
        e.notes ?? '',
        memberMap.get(e.logged_by_id) ?? String(e.logged_by_id),
      ]
    } else {
      const c   = row.data
      const def = definitionMap.get(c.chore_definition_id)
      const defLabel = def
        ? [def.emoji, def.name].filter(Boolean).join(' ')
        : `Chore #${c.chore_definition_id}`
      return [
        formatDateTime(c.occurred_at),
        'Household',
        'Household chore',
        defLabel,
        c.notes ?? '',
        memberMap.get(c.logged_by_id) ?? String(c.logged_by_id),
      ]
    }
  })
  const csvContent = [header, ...csvRows]
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
  'feeding', 'weight', 'note',
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
  const tier            = useEffectiveTier()
  const isPremium       = tier === 'premium'

  usePageTitle('Care History')

  // Seed catFilter from ?catId= so CatHistoryPage can jump here pre-filtered
  const initialCatId = searchParams.get('catId') ? Number(searchParams.get('catId')) : ''

  const [startDate,             setStartDate]             = useState(DEFAULT_START)
  const [endDate,               setEndDate]               = useState(DEFAULT_END)
  const [catFilter,             setCatFilter]             = useState<number | ''>(initialCatId)
  const [typeFilter,            setTypeFilter]            = useState<TypeFilterValue>('')
  const [subtypeFilter,         setSubtypeFilter]         = useState('')
  const [choreDefinitionFilter, setChoreDefinitionFilter] = useState<number | ''>('')
  const [memberFilter,          setMemberFilter]          = useState<number | ''>('')
  // null = custom / no quick range active; number = days value (null days = all-time)
  const [activeQuickDays, setActiveQuickDays] = useState<number | null | 'custom'>('custom')

  // Derived visibility flags
  const showChores = typeFilter === '' || typeFilter === 'chore'
  const showEvents = typeFilter !== 'chore'

  const subtypeConfig = (typeFilter && typeFilter !== 'chore')
    ? SUBTYPE_CONFIG[typeFilter as EventType]
    : undefined

  function handleTypeChange(value: TypeFilterValue) {
    setTypeFilter(value)
    setSubtypeFilter('')
    if (value !== 'chore') setChoreDefinitionFilter('')
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
    startDate !== DEFAULT_START      ||
    endDate   !== DEFAULT_END        ||
    catFilter             !== ''     ||
    typeFilter            !== ''     ||
    subtypeFilter         !== ''     ||
    choreDefinitionFilter !== ''     ||
    memberFilter          !== ''

  function resetAllFilters() {
    setStartDate(DEFAULT_START)
    setEndDate(DEFAULT_END)
    setCatFilter('')
    setTypeFilter('')
    setSubtypeFilter('')
    setChoreDefinitionFilter('')
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
    () => applySubtypeFilter(rawEvents, typeFilter as EventType | '', subtypeFilter),
    [rawEvents, typeFilter, subtypeFilter]
  )

  // ── Chore queries ─────────────────────────────────────────────────────────
  const { data: choreDefsData } = useQuery({
    queryKey: ['chore_definitions', hId],
    queryFn:  () => api.getHouseholdChoreDefinitions(hId),
    enabled:  isPremium,
    staleTime: 5 * 60 * 1000,
  })
  const choreDefs: HouseholdChoreDefinition[] = choreDefsData?.data?.data ?? []

  const { data: choresData } = useQuery({
    queryKey: ['household_chores_history', hId, startDate, endDate, memberFilter],
    queryFn:  () =>
      api.getHouseholdChores(hId, {
        startDate:  startDate  || undefined,
        endDate:    endDate    || undefined,
        loggedById: memberFilter ? Number(memberFilter) : undefined,
      }),
    enabled:   isPremium && showChores,
    staleTime: 60_000,
  })
  const rawChores: HouseholdChore[] = choresData?.data?.data ?? []

  // Chore definition sub-filter is client-side
  const filteredChores = useMemo(() => {
    if (!choreDefinitionFilter) return rawChores
    return rawChores.filter((c) => c.chore_definition_id === choreDefinitionFilter)
  }, [rawChores, choreDefinitionFilter])

  const memberMap = useMemo(
    () => new Map<number, string>((household?.members ?? []).map((m) => [m.id, m.name])),
    [household]
  )
  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats])

  const definitionMap = useMemo(
    () => new Map(choreDefs.map((d) => [d.id, d])),
    [choreDefs]
  )

  // Merge events + chores into a single chronological list
  const allRows: UnifiedRow[] = useMemo(() => {
    const eventRows: UnifiedRow[] = showEvents
      ? events.map((e) => ({ kind: 'event' as const, data: e }))
      : []
    // Chore rows are household-level — hidden when filtering by a specific cat
    const choreRows: UnifiedRow[] = (showChores && catFilter === '')
      ? filteredChores.map((c) => ({ kind: 'chore' as const, data: c }))
      : []
    return [...eventRows, ...choreRows].sort(
      (a, b) => new Date(b.data.occurred_at).getTime() - new Date(a.data.occurred_at).getTime()
    )
  }, [showEvents, showChores, catFilter, events, filteredChores])

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
        subtitle={`${allRows.length} record${allRows.length !== 1 ? 's' : ''} in selected range`}
        backTo={{ label: 'Dashboard', onClick: () => navigate('/dashboard') }}
        action={
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={allRows.length === 0}
            onClick={() => exportToCsv(allRows, cats, memberMap, definitionMap)}
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
              className="w-full h-11 sm:h-9 rounded-md border border-input bg-background px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none min-w-0 block"
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
              className="w-full h-11 sm:h-9 rounded-md border border-input bg-background px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none min-w-0 block"
            />
            <div className="h-5 flex items-center">
              {endDate !== DEFAULT_END && (
                <ClearBtn onClick={() => setEndDate(DEFAULT_END)} />
              )}
            </div>
          </div>

          {/* Cat — disabled when filtering by household chores */}
          <div className="space-y-1 min-w-0">
            <label className={['text-xs', typeFilter === 'chore' ? 'text-muted-foreground/40' : 'text-muted-foreground'].join(' ')}>
              Cat
            </label>
            <select
              value={catFilter}
              disabled={typeFilter === 'chore'}
              onChange={(e) => setCatFilter(e.target.value === '' ? '' : Number(e.target.value))}
              className={[
                'w-full h-11 sm:h-9 rounded-md border border-input bg-background px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                typeFilter === 'chore' ? 'opacity-40 cursor-not-allowed' : '',
              ].join(' ')}
            >
              <option value="">All cats</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="h-5 flex items-center">
              {catFilter !== '' && typeFilter !== 'chore' && (
                <ClearBtn onClick={() => setCatFilter('')} />
              )}
            </div>
          </div>

          {/* Type */}
          <div className="space-y-1 min-w-0">
            <label className="text-xs text-muted-foreground">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => handleTypeChange(e.target.value as TypeFilterValue)}
              className="w-full h-11 sm:h-9 rounded-md border border-input bg-background px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All types</option>
              {ALL_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>
              ))}
              <option value="chore">Household chore</option>
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
              className="w-full h-11 sm:h-9 rounded-md border border-input bg-background px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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

        {/* Row 2a: event sub-type filter — only shown when selected type has sub-types */}
        {subtypeConfig && (
          <div className="pt-1 border-t border-border/40 flex items-end gap-3">
            <div className="space-y-1 w-full sm:w-56 min-w-0">
              <label className="text-xs text-muted-foreground">{subtypeConfig.label}</label>
              {subtypeConfig.kind === 'select' ? (
                <select
                  value={subtypeFilter}
                  onChange={(e) => setSubtypeFilter(e.target.value)}
                  className="w-full h-11 sm:h-9 rounded-md border border-input bg-background px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                  className="h-11 sm:h-9 text-base sm:text-sm w-full"
                />
              )}
            </div>
            {subtypeFilter && (
              <ClearBtn onClick={() => setSubtypeFilter('')} />
            )}
          </div>
        )}

        {/* Row 2b: chore definition filter — only shown when type = "Household chore" */}
        {typeFilter === 'chore' && choreDefs.length > 0 && (
          <div className="pt-1 border-t border-border/40 flex items-end gap-3">
            <div className="space-y-1 w-full sm:w-56 min-w-0">
              <label className="text-xs text-muted-foreground">Chore</label>
              <select
                value={choreDefinitionFilter}
                onChange={(e) => setChoreDefinitionFilter(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full h-11 sm:h-9 rounded-md border border-input bg-background px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All chores</option>
                {choreDefs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.emoji ? `${d.emoji} ${d.name}` : d.name}
                  </option>
                ))}
              </select>
            </div>
            {choreDefinitionFilter !== '' && (
              <ClearBtn onClick={() => setChoreDefinitionFilter('')} />
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
      ) : allRows.length === 0 ? (
        <EmptyState
          icon={TableProperties}
          title="No records found"
          description={[
            typeFilter === 'chore'
              ? 'No household chore entries'
              : typeFilter
                ? `No ${EVENT_TYPE_LABEL[typeFilter as EventType] ?? typeFilter} events`
                : 'No records',
            catFilter ? ` for ${catMap.get(Number(catFilter)) ?? 'selected cat'}` : '',
            ' in this period.',
            hasActiveFilters ? ' Try adjusting your filters or date range.' : '',
          ].join('')}
        />
      ) : (
        <>
          {isFetching && <div className="h-0.5 bg-sky-500 animate-pulse rounded-full" />}

          {/* Mobile: card list */}
          <div className="sm:hidden space-y-2">
            {allRows.map((row) => {
              if (row.kind === 'event') {
                const event      = row.data
                const color      = EVENT_COLORS[event.event_type]
                const catName    = catMap.get(event.cat_id) ?? '—'
                const loggerName = memberMap.get(event.logged_by_id)
                  ?? (event.logged_by_id === user?.id ? 'You' : String(event.logged_by_id))
                const summary    = formatEventSummary(event)
                return (
                  <div key={`event-${event.id}`} className="rounded-xl border bg-card p-3 space-y-2">
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
              } else {
                const chore      = row.data
                const def        = definitionMap.get(chore.chore_definition_id)
                const loggerName = memberMap.get(chore.logged_by_id)
                  ?? (chore.logged_by_id === user?.id ? 'You' : String(chore.logged_by_id))
                return (
                  <div key={`chore-${chore.id}`} className="rounded-xl border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
                        style={{ backgroundColor: `${CHORE_COLOR}15`, color: CHORE_COLOR }}
                      >
                        <Home className="size-2.5" aria-hidden="true" />
                        Household chore
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(chore.occurred_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium truncate">
                        {def ? [def.emoji, def.name].filter(Boolean).join(' ') : `Chore #${chore.chore_definition_id}`}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">{loggerName}</span>
                    </div>
                    {chore.notes && (
                      <div className="text-xs text-muted-foreground border-t border-border/40 pt-2">
                        <p className="truncate" title={chore.notes}>{chore.notes}</p>
                      </div>
                    )}
                  </div>
                )
              }
            })}
          </div>

          {/* Desktop: full table */}
          <div className="hidden sm:block rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto max-h-[65dvh] overflow-y-auto">
              <table className="min-w-[640px] w-full text-sm">
                <thead className="bg-muted/50 border-b sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Date / Time</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Cat / Source</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Details</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Notes</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Logged by</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allRows.map((row) => {
                    if (row.kind === 'event') {
                      const event      = row.data
                      const color      = EVENT_COLORS[event.event_type]
                      const catName    = catMap.get(event.cat_id) ?? '—'
                      const loggerName = memberMap.get(event.logged_by_id)
                        ?? (event.logged_by_id === user?.id ? 'You' : String(event.logged_by_id))
                      return (
                        <tr key={`event-${event.id}`} className="hover:bg-muted/30 transition-colors">
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
                    } else {
                      const chore      = row.data
                      const def        = definitionMap.get(chore.chore_definition_id)
                      const defLabel   = def
                        ? [def.emoji, def.name].filter(Boolean).join(' ')
                        : `Chore #${chore.chore_definition_id}`
                      const loggerName = memberMap.get(chore.logged_by_id)
                        ?? (chore.logged_by_id === user?.id ? 'You' : String(chore.logged_by_id))
                      return (
                        <tr key={`chore-${chore.id}`} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap tabular-nums text-xs">
                            {formatDateTime(chore.occurred_at)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Home className="size-3 shrink-0" aria-hidden="true" />
                              Household
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: `${CHORE_COLOR}15`, color: CHORE_COLOR }}
                            >
                              <Home className="size-2.5" aria-hidden="true" />
                              Household chore
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{defLabel}</td>
                          <td
                            className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate"
                            title={chore.notes ?? undefined}
                          >
                            {chore.notes || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                            {loggerName}
                          </td>
                        </tr>
                      )
                    }
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
