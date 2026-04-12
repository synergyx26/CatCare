import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Lock, AlertTriangle, SlidersHorizontal, Check } from 'lucide-react'
import type { DayStats, EventType, SubscriptionTier } from '@/types/api'
import { EVENT_COLORS, EVENT_LABELS } from '@/lib/eventColors'

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const ALL_EVENT_TYPES: EventType[] = [
  'feeding', 'litter', 'water', 'weight',
  'note', 'medication', 'vet_visit', 'grooming',
  'symptom', 'tooth_brushing',
]

const CARE_ONLY_TYPES: Set<EventType> = new Set(['feeding', 'litter', 'water', 'medication'])

// Activity intensity: 0=none, 1=light (1–2 events), 2=moderate (3–5), 3=high (6+)
// Background css per level — for normal in-range cells only (selected/today/missing override these)
const ACTIVITY_BG = [
  'hover:bg-muted/50 cursor-pointer',                            // 0: no events
  'bg-primary/5 hover:bg-primary/10 cursor-pointer',            // 1: light
  'bg-primary/15 hover:bg-primary/20 cursor-pointer',           // 2: moderate
  'bg-primary/25 hover:bg-primary/30 cursor-pointer',           // 3: high
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarDayCell {
  dateStr: string | null   // null = padding cell
  dayNumber: number | null
  stats: DayStats | null
  isInRange: boolean
  isFuture: boolean
  isToday: boolean
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CalendarViewChartProps {
  data: DayStats[]
  startDate: string        // stats.start_date, ISO8601
  endDate: string          // stats.end_date, ISO8601
  tier: SubscriptionTier
  feedingsPerDay: number   // 0 = not tracked
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDateStr(isoDate: string): string {
  // Parse as noon local time to avoid UTC boundary flip
  return new Date(isoDate.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA')
}

function getToday(): string {
  return new Date().toLocaleDateString('en-CA')
}

function isMissingCare(stats: DayStats | null, feedingsPerDay: number, dateStr: string): boolean {
  if (feedingsPerDay === 0) return false
  if (dateStr > getToday()) return false
  return (stats?.types['feeding'] ?? 0) < feedingsPerDay
}

function buildCalendarDays(
  year: number,
  month: number,
  dayStatsMap: Map<string, DayStats>,
  startDate: string,
  endDate: string,
  today: string,
): CalendarDayCell[] {
  const firstDow = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: CalendarDayCell[] = []

  // Leading padding
  for (let i = 0; i < firstDow; i++) {
    cells.push({ dateStr: null, dayNumber: null, stats: null, isInRange: false, isFuture: false, isToday: false })
  }

  // Real days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = new Date(year, month, d).toLocaleDateString('en-CA')
    const stats = dayStatsMap.get(dateStr) ?? null
    cells.push({
      dateStr,
      dayNumber: d,
      stats,
      isInRange: dateStr >= startDate && dateStr <= endDate,
      isFuture: dateStr > today,
      isToday: dateStr === today,
    })
  }

  // Trailing padding to reach 42 cells (6 rows × 7 cols)
  while (cells.length < 42) {
    cells.push({ dateStr: null, dayNumber: null, stats: null, isInRange: false, isFuture: false, isToday: false })
  }

  return cells
}

// ─── Intensity helpers ────────────────────────────────────────────────────────

/** Count events matching active filters for a given day */
function getFilteredCount(stats: DayStats | null, filters: Set<EventType>): number {
  if (!stats) return 0
  return ALL_EVENT_TYPES
    .filter(t => filters.has(t))
    .reduce((sum, t) => sum + (stats.types[t] ?? 0), 0)
}

/** Map a filtered event count to an activity level 0–3 */
function toActivityLevel(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  return 3
}

interface DayDetailPanelProps {
  dateStr: string
  stats: DayStats | null
  isInRange: boolean
  feedingsPerDay: number
  onClose: () => void
}

function DayDetailPanel({ dateStr, stats, isInRange, feedingsPerDay, onClose }: DayDetailPanelProps) {
  const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const today = getToday()
  const missing = isInRange && isMissingCare(stats, feedingsPerDay, dateStr)

  const eventRows = !isInRange
    ? []
    : ALL_EVENT_TYPES
        .filter(t => (stats?.types[t] ?? 0) > 0)
        .sort((a, b) => (stats?.types[b] ?? 0) - (stats?.types[a] ?? 0))

  return (
    <div className="shrink-0 border-t border-border/50 pt-2 pb-1 px-1 overflow-auto" style={{ maxHeight: 192 }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
          aria-label="Close day detail"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!isInRange && (
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <Lock className="w-3 h-3 shrink-0" />
          <span>{dateStr > today ? 'No data yet' : 'No data available for this date'}</span>
        </div>
      )}

      {isInRange && missing && (
        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs mb-1.5 bg-amber-50 dark:bg-amber-950/30 rounded px-1.5 py-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>
            Only {stats?.types['feeding'] ?? 0} of {feedingsPerDay} feedings logged
          </span>
        </div>
      )}

      {isInRange && eventRows.length === 0 && (
        <p className="text-xs text-muted-foreground">No events logged on this day.</p>
      )}

      {isInRange && eventRows.length > 0 && (
        <div className="flex flex-col gap-1">
          {eventRows.map(t => (
            <div key={t} className="flex items-center gap-1.5 text-xs">
              <span
                style={{ background: EVENT_COLORS[t] }}
                className="w-2 h-2 rounded-full shrink-0"
              />
              <span className="text-foreground/80">{EVENT_LABELS[t]}</span>
              <span className="ml-auto text-muted-foreground font-medium">×{stats!.types[t]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface EventTypeFilterProps {
  presentTypes: EventType[]
  activeFilters: Set<EventType>
  onToggle: (type: EventType) => void
  onAll: () => void
  onCareOnly: () => void
}

function EventTypeFilterCombobox({ presentTypes, activeFilters, onToggle, onAll, onCareOnly }: EventTypeFilterProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (presentTypes.length === 0) return null

  const allActive = presentTypes.every(t => activeFilters.has(t))
  const activeCount = presentTypes.filter(t => activeFilters.has(t)).length
  const label = allActive ? 'All' : activeCount === 0 ? 'None' : `${activeCount}/${presentTypes.length}`

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Filter event types: ${allActive ? 'all active' : `${activeCount} of ${presentTypes.length} active`}`}
        className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-lg border border-border bg-card hover:bg-muted/60 text-foreground transition-colors"
      >
        <SlidersHorizontal className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
        <span>{label}</span>
        <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform duration-150 ${open ? '-rotate-90' : 'rotate-90'}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label="Filter event types"
          className="absolute top-full right-0 mt-1 z-20 bg-popover border border-border rounded-xl shadow-lg overflow-hidden min-w-[152px] py-1"
        >
          {/* Shortcuts */}
          <button
            role="option"
            aria-selected={allActive}
            onClick={onAll}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] hover:bg-muted/60 transition-colors"
          >
            <Check className={`w-3 h-3 shrink-0 text-primary ${allActive ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
            <span className={allActive ? 'text-primary font-medium' : 'text-foreground'}>All events</span>
          </button>
          <button
            role="option"
            aria-selected={false}
            onClick={onCareOnly}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] hover:bg-muted/60 transition-colors text-foreground"
          >
            <span className="w-3 h-3 shrink-0" aria-hidden="true" />
            Care only
          </button>
          <div className="border-t border-border/50 my-1" role="separator" />
          {/* Per-type toggles */}
          {presentTypes.map(t => {
            const active = activeFilters.has(t)
            return (
              <button
                key={t}
                role="option"
                aria-selected={active}
                onClick={() => onToggle(t)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] hover:bg-muted/60 transition-colors text-foreground"
              >
                <Check className={`w-3 h-3 shrink-0 text-primary ${active ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: EVENT_COLORS[t] }}
                  aria-hidden="true"
                />
                {EVENT_LABELS[t]}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CalendarViewChart({ data, startDate, endDate, tier, feedingsPerDay }: CalendarViewChartProps) {
  const normStart = useMemo(() => toLocalDateStr(startDate), [startDate])
  const normEnd = useMemo(() => toLocalDateStr(endDate), [endDate])
  const today = getToday()

  const [displayMonth, setDisplayMonth] = useState<{ year: number; month: number }>(() => {
    const d = new Date(normEnd + 'T12:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<EventType>>(() => new Set(ALL_EVENT_TYPES))

  // Reset display month when endDate changes (e.g. range/offset changed in parent)
  useEffect(() => {
    const d = new Date(normEnd + 'T12:00:00')
    setDisplayMonth({ year: d.getFullYear(), month: d.getMonth() })
    setSelectedDate(null)
  }, [normEnd])

  // Clear selected date when month changes
  useEffect(() => {
    setSelectedDate(null)
  }, [displayMonth])

  // Escape key closes panel
  useEffect(() => {
    if (!selectedDate) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedDate(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedDate])

  const dayStatsMap = useMemo(() => {
    const map = new Map<string, DayStats>()
    for (const d of data) map.set(d.date, d)
    return map
  }, [data])

  const presentTypes = useMemo(() => {
    const counts: Partial<Record<EventType, number>> = {}
    for (const d of data) {
      for (const [type, count] of Object.entries(d.types)) {
        counts[type as EventType] = (counts[type as EventType] ?? 0) + (count ?? 0)
      }
    }
    return ALL_EVENT_TYPES.filter(t => (counts[t] ?? 0) > 0)
  }, [data])

  const calendarDays = useMemo(
    () => buildCalendarDays(displayMonth.year, displayMonth.month, dayStatsMap, normStart, normEnd, today),
    [displayMonth, dayStatsMap, normStart, normEnd, today],
  )

  const canGoBack = useMemo(() => {
    const prevMonthEnd = new Date(displayMonth.year, displayMonth.month, 0)
    return prevMonthEnd >= new Date(normStart + 'T12:00:00')
  }, [displayMonth, normStart])

  const canGoForward = useMemo(() => {
    const nextMonthStart = new Date(displayMonth.year, displayMonth.month + 1, 1)
    return nextMonthStart <= new Date(normEnd + 'T12:00:00')
  }, [displayMonth, normEnd])

  const isAtTierBoundaryBack = canGoBack === false && tier !== 'premium'

  const handlePrev = useCallback(() => {
    if (!canGoBack) return
    setDisplayMonth(m => {
      if (m.month === 0) return { year: m.year - 1, month: 11 }
      return { year: m.year, month: m.month - 1 }
    })
  }, [canGoBack])

  const handleNext = useCallback(() => {
    if (!canGoForward) return
    setDisplayMonth(m => {
      if (m.month === 11) return { year: m.year + 1, month: 0 }
      return { year: m.year, month: m.month + 1 }
    })
  }, [canGoForward])

  const handleDayClick = useCallback((cell: CalendarDayCell) => {
    if (!cell.dateStr) return
    setSelectedDate(prev => prev === cell.dateStr ? null : cell.dateStr)
  }, [])

  const handleToggleFilter = useCallback((type: EventType) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const handleAll = useCallback(() => {
    setActiveFilters(new Set(ALL_EVENT_TYPES))
  }, [])

  const handleCareOnly = useCallback(() => {
    setActiveFilters(new Set(CARE_ONLY_TYPES))
  }, [])

  const monthLabel = new Date(displayMonth.year, displayMonth.month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const selectedCell = selectedDate
    ? calendarDays.find(c => c.dateStr === selectedDate) ?? null
    : null

  return (
    <div className="flex flex-col h-full gap-1.5 overflow-hidden">
      {/* Header: month nav + filter combobox */}
      <div className="relative flex items-center shrink-0">
        <button
          onClick={handlePrev}
          disabled={!canGoBack}
          aria-label="Previous month"
          className={`relative z-10 flex items-center justify-center w-6 h-6 rounded transition-colors ${
            canGoBack
              ? 'hover:bg-muted text-foreground'
              : 'text-muted-foreground/40 cursor-not-allowed'
          }`}
        >
          {isAtTierBoundaryBack ? (
            <Lock className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
        {/* Month label absolutely centered so the filter combobox doesn't shift it */}
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground pointer-events-none">
          {monthLabel}
        </span>
        <div className="relative z-10 ml-auto flex items-center gap-1">
          <EventTypeFilterCombobox
            presentTypes={presentTypes}
            activeFilters={activeFilters}
            onToggle={handleToggleFilter}
            onAll={handleAll}
            onCareOnly={handleCareOnly}
          />
          <button
            onClick={handleNext}
            disabled={!canGoForward}
            aria-label="Next month"
            className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${
              canGoForward
                ? 'hover:bg-muted text-foreground'
                : 'text-muted-foreground/40 cursor-not-allowed'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 shrink-0">
        {WEEKDAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 grid-rows-6 gap-1 flex-1 min-h-0">
        {calendarDays.map((cell, i) => {
          if (!cell.dateStr || cell.dayNumber === null) {
            return <div key={i} />
          }

          const missing = isMissingCare(cell.stats, feedingsPerDay, cell.dateStr)
          const isSelected = selectedDate === cell.dateStr
          const filteredCount = getFilteredCount(cell.stats, activeFilters)
          const level = cell.isInRange ? toActivityLevel(filteredCount) : 0
          const eventCount = cell.isInRange ? (cell.stats?.count ?? 0) : 0
          const ariaLabel = [
            cell.dayNumber,
            cell.isInRange ? (eventCount === 1 ? '1 event' : `${eventCount} events`) : 'outside range',
            missing ? 'missing care' : null,
          ].filter(Boolean).join(', ')

          // Cell background priority:
          //   1. out-of-range   → dim (no interaction)
          //   2. selected+today → sky tint (selection overrides activity)
          //   3. selected only  → primary tint
          //   4. today only     → sky tint (today identity overrides activity)
          //   5. missing care   → amber alert (overrides activity)
          //   6. activity level → heatmap wash (0=plain, 1–3=increasing primary blue)
          const cellBg =
            !cell.isInRange              ? 'opacity-40 cursor-default' :
            isSelected && cell.isToday   ? 'bg-sky-100/80 dark:bg-sky-900/40 cursor-pointer' :
            isSelected                   ? 'bg-primary/10 dark:bg-primary/20 cursor-pointer' :
            cell.isToday                 ? 'bg-sky-50/80 dark:bg-sky-950/30 cursor-pointer' :
            missing                      ? 'bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-50/80 cursor-pointer' :
                                           ACTIVITY_BG[level]

          // Day number badge:
          //   today            → filled sky-500 circle (permanent identity marker)
          //   today + selected → filled sky-500 circle + sky ring (selected overlay on top of identity)
          //   selected only    → ring outline in primary color (transient selection, no fill)
          //   in-range         → plain text
          //   out-of-range     → muted text
          const dayNumberClass = cell.isToday && isSelected
            ? 'bg-sky-500 text-white ring-2 ring-sky-300 dark:ring-sky-600'
            : cell.isToday
              ? 'bg-sky-500 text-white'
              : isSelected
                ? 'ring-2 ring-primary text-primary'
                : cell.isInRange
                  ? 'text-foreground'
                  : 'text-muted-foreground'

          return (
            <button
              key={i}
              onClick={() => handleDayClick(cell)}
              disabled={!cell.isInRange}
              aria-label={ariaLabel}
              aria-current={cell.isToday ? 'date' : undefined}
              className={[
                'relative rounded-lg flex items-start justify-start p-1.5 text-left transition-colors',
                cellBg,
              ].join(' ')}
            >
              {/* Day number — filled circle for today, ring outline for selected, plain text otherwise */}
              <span
                className={[
                  'text-[10px] leading-none font-semibold w-4 h-4 flex items-center justify-center rounded-full shrink-0',
                  dayNumberClass,
                ].join(' ')}
              >
                {cell.dayNumber}
              </span>

              {/* Out-of-range lock icon */}
              {!cell.isInRange && !cell.isFuture && tier !== 'premium' && (
                <Lock className="absolute top-0.5 right-0.5 w-2 h-2 text-muted-foreground/50" />
              )}

              {/* Missing care indicator — bottom-right amber notch */}
              {missing && (
                <span
                  className="absolute bottom-0 right-0 w-0 h-0"
                  style={{
                    borderStyle: 'solid',
                    borderWidth: '0 0 7px 7px',
                    borderColor: 'transparent transparent #f59e0b transparent',
                  }}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Intensity legend */}
      <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
        <span className="text-[9px] text-muted-foreground">Less</span>
        <span className="w-3 h-3 rounded-sm bg-muted/40" />
        <span className="w-3 h-3 rounded-sm bg-primary/5" />
        <span className="w-3 h-3 rounded-sm bg-primary/15" />
        <span className="w-3 h-3 rounded-sm bg-primary/25" />
        <span className="text-[9px] text-muted-foreground">More</span>
        <span className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-200/80 dark:bg-amber-950/40 inline-block" />
          Missing care
        </span>
      </div>

      {/* Empty state when no events exist in data at all */}
      {data.every(d => d.count === 0) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xs text-muted-foreground">No care events logged yet</p>
        </div>
      )}

      {/* Day detail panel */}
      {selectedDate && selectedCell && (
        <DayDetailPanel
          dateStr={selectedDate}
          stats={selectedCell.stats}
          isInRange={selectedCell.isInRange}
          feedingsPerDay={feedingsPerDay}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  )
}
