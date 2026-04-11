import { useState, useMemo, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Lock, AlertTriangle } from 'lucide-react'
import type { DayStats, EventType, SubscriptionTier } from '@/types/api'
import { EVENT_COLORS, EVENT_LABELS } from '@/lib/eventColors'

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const MAX_VISIBLE_DOTS = 4

const ALL_EVENT_TYPES: EventType[] = [
  'feeding', 'litter', 'water', 'weight',
  'note', 'medication', 'vet_visit', 'grooming',
  'symptom', 'tooth_brushing',
]

const CARE_ONLY_TYPES: Set<EventType> = new Set(['feeding', 'litter', 'water', 'medication'])

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

// ─── Sub-components ───────────────────────────────────────────────────────────

interface EventDotRowProps {
  types: DayStats['types']
  activeFilters: Set<EventType>
}

function EventDotRow({ types, activeFilters }: EventDotRowProps) {
  const visible = ALL_EVENT_TYPES.filter(t => activeFilters.has(t) && (types[t] ?? 0) > 0)
  const shown = visible.slice(0, MAX_VISIBLE_DOTS)
  const overflow = visible.length - MAX_VISIBLE_DOTS

  if (visible.length === 0) return null

  return (
    <div className="flex items-center gap-[2px] flex-wrap mt-0.5 min-h-[8px]">
      {shown.map(t => (
        <span
          key={t}
          style={{ background: EVENT_COLORS[t] }}
          className="w-1.5 h-1.5 rounded-full shrink-0"
          aria-label={EVENT_LABELS[t]}
        />
      ))}
      {overflow > 0 && (
        <span className="text-[9px] text-muted-foreground leading-none">+{overflow}</span>
      )}
    </div>
  )
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

function EventTypeFilter({ presentTypes, activeFilters, onToggle, onAll, onCareOnly }: EventTypeFilterProps) {
  if (presentTypes.length === 0) return null

  const allActive = presentTypes.every(t => activeFilters.has(t))

  return (
    <div className="flex items-center gap-1 flex-wrap shrink-0">
      <button
        onClick={onAll}
        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
          allActive
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
        }`}
        aria-label="Show all event types"
      >
        All
      </button>
      <button
        onClick={onCareOnly}
        className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Show care events only"
      >
        Care
      </button>
      {presentTypes.map(t => {
        const active = activeFilters.has(t)
        return (
          <button
            key={t}
            role="checkbox"
            aria-checked={active}
            aria-label={`${active ? 'Hide' : 'Show'} ${EVENT_LABELS[t]} events`}
            onClick={() => onToggle(t)}
            className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
              active
                ? 'border-transparent'
                : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
            }`}
            style={active ? {
              background: EVENT_COLORS[t] + '26',  // ~15% opacity
              borderColor: EVENT_COLORS[t] + '66', // ~40% opacity
              color: EVENT_COLORS[t],
            } : undefined}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: active ? EVENT_COLORS[t] : undefined }}
            />
            {EVENT_LABELS[t]}
          </button>
        )
      })}
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
      {/* Header: month nav */}
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={handlePrev}
          disabled={!canGoBack}
          aria-label="Previous month"
          className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${
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
        <span className="text-xs font-semibold text-foreground">{monthLabel}</span>
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

      {/* Event type filter */}
      <EventTypeFilter
        presentTypes={presentTypes}
        activeFilters={activeFilters}
        onToggle={handleToggleFilter}
        onAll={handleAll}
        onCareOnly={handleCareOnly}
      />

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
          const eventCount = cell.isInRange ? (cell.stats?.count ?? 0) : 0
          const ariaLabel = [
            cell.dayNumber,
            cell.isInRange ? (eventCount === 1 ? '1 event' : `${eventCount} events`) : 'outside range',
            missing ? 'missing care' : null,
          ].filter(Boolean).join(', ')

          // State communicated through fill only — no rings or borders
          const cellBg =
            !cell.isInRange              ? 'opacity-40 cursor-default' :
            isSelected && cell.isToday   ? 'bg-sky-100/80 dark:bg-sky-900/40 cursor-pointer' :
            isSelected                   ? 'bg-primary/15 cursor-pointer' :
            cell.isToday                 ? 'bg-sky-50/80 dark:bg-sky-950/30 cursor-pointer' :
            missing                      ? 'bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50/70 cursor-pointer' :
                                           'hover:bg-muted/50 cursor-pointer'

          return (
            <button
              key={i}
              onClick={() => handleDayClick(cell)}
              disabled={!cell.isInRange}
              aria-label={ariaLabel}
              aria-current={cell.isToday ? 'date' : undefined}
              className={[
                'relative rounded-lg flex flex-col items-start justify-start p-1 text-left transition-colors',
                cellBg,
              ].join(' ')}
            >
              {/* Day number — filled circle for today/selected, plain text otherwise */}
              <span
                className={[
                  'text-[10px] leading-none font-semibold w-4 h-4 flex items-center justify-center rounded-full shrink-0',
                  cell.isToday
                    ? 'bg-sky-500 text-white'
                    : isSelected
                      ? 'bg-primary text-primary-foreground'
                      : cell.isInRange
                        ? 'text-foreground'
                        : 'text-muted-foreground',
                ].join(' ')}
              >
                {cell.dayNumber}
              </span>

              {/* Event dots — pushed to bottom */}
              {cell.isInRange && cell.stats && (
                <div className="mt-auto">
                  <EventDotRow types={cell.stats.types} activeFilters={activeFilters} />
                </div>
              )}

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

      {/* Empty state overlay when no events exist in data at all */}
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
