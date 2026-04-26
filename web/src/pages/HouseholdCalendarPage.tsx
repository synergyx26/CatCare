import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Lock,
  Plus,
  X,
  AlertTriangle,
  Pencil,
  Trash2,
} from 'lucide-react'
import { api } from '@/api/client'
import { useEffectiveTier } from '@/hooks/useEffectiveTier'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PageHeader } from '@/components/layout/PageHeader'
import { LogCareModal } from '@/components/LogCareModal'
import { EVENT_COLORS, EVENT_LABELS } from '@/lib/eventColors'
import { formatEventSummary } from '@/lib/helpers'
import { notify } from '@/lib/notify'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { Cat, CareEvent, EventType, SubscriptionTier, Household, HouseholdChore, HouseholdChoreDefinition } from '@/types/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const ALL_EVENT_TYPES: EventType[] = [
  'feeding', 'weight',
  'note', 'medication', 'vet_visit', 'grooming',
  'symptom', 'tooth_brushing',
]

// Palette for cat avatars — cycles by cat index
const CAT_AVATAR_COLORS = [
  '#818cf8', '#34d399', '#fb923c', '#f472b6',
  '#38bdf8', '#a3e635', '#e879f9', '#4ade80',
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthYear { year: number; month: number }

type LogModalState =
  | { open: false }
  | { open: true; cat: Cat; date: string; event?: CareEvent }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toLocaleDateString('en-CA')
}

function toMonthStart(my: MonthYear): string {
  return new Date(my.year, my.month, 1).toLocaleDateString('en-CA')
}

function toMonthEnd(my: MonthYear): string {
  return new Date(my.year, my.month + 1, 0).toLocaleDateString('en-CA')
}

function prevMonth(my: MonthYear): MonthYear {
  if (my.month === 0) return { year: my.year - 1, month: 11 }
  return { year: my.year, month: my.month - 1 }
}

function nextMonth(my: MonthYear): MonthYear {
  if (my.month === 11) return { year: my.year + 1, month: 0 }
  return { year: my.year, month: my.month + 1 }
}

function currentMonthYear(): MonthYear {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() }
}

function isCurrentOrFuture(my: MonthYear): boolean {
  const now = new Date()
  return my.year > now.getFullYear() || (my.year === now.getFullYear() && my.month >= now.getMonth())
}

/** Earliest month the user can navigate back to for their tier. null = unlimited. */
function earliestAllowedMonth(tier: SubscriptionTier): MonthYear | null {
  if (tier === 'premium') return null
  if (tier === 'pro') {
    const d = new Date()
    d.setDate(d.getDate() - 180)
    return { year: d.getFullYear(), month: d.getMonth() }
  }
  return currentMonthYear()
}

function canGoBack(my: MonthYear, tier: SubscriptionTier): boolean {
  const limit = earliestAllowedMonth(tier)
  if (!limit) return true
  const prev = prevMonth(my)
  return prev.year > limit.year || (prev.year === limit.year && prev.month >= limit.month)
}

function monthLabel(my: MonthYear): string {
  return new Date(my.year, my.month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function buildDays(my: MonthYear): (string | null)[] {
  const firstDow = new Date(my.year, my.month, 1).getDay()
  const daysInMonth = new Date(my.year, my.month + 1, 0).getDate()
  const cells: (string | null)[] = Array(firstDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(my.year, my.month, d).toLocaleDateString('en-CA'))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function formatDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function catAvatarColor(index: number): string {
  return CAT_AVATAR_COLORS[index % CAT_AVATAR_COLORS.length]
}

// ─── Sub-component: EventTypePill filter ──────────────────────────────────────

interface TypeFilterProps {
  presentTypes: EventType[]
  activeFilters: Set<EventType>
  onToggle: (t: EventType) => void
  onAll: () => void
}

function TypeFilter({ presentTypes, activeFilters, onToggle, onAll }: TypeFilterProps) {
  if (presentTypes.length === 0) return null
  const allActive = presentTypes.every(t => activeFilters.has(t))
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={onAll}
        className={`text-xs px-2 py-1 rounded-full border transition-colors ${
          allActive
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground'
        }`}
      >
        All types
      </button>
      {presentTypes.map(t => {
        const active = activeFilters.has(t)
        return (
          <button
            key={t}
            onClick={() => onToggle(t)}
            aria-checked={active}
            role="checkbox"
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-colors ${
              active ? 'border-transparent' : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground'
            }`}
            style={active ? {
              background: EVENT_COLORS[t] + '22',
              borderColor: EVENT_COLORS[t] + '60',
              color: EVENT_COLORS[t],
            } : undefined}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? EVENT_COLORS[t] : 'currentColor', opacity: active ? 1 : 0.4 }} />
            {EVENT_LABELS[t]}
          </button>
        )
      })}
    </div>
  )
}

// ─── Sub-component: Calendar day cell ────────────────────────────────────────

interface DayCellProps {
  dateStr: string
  events: CareEvent[]
  activeFilters: Set<EventType>
  isSelected: boolean
  isInRange: boolean
  feedingsPerDayMap: Map<number, number>
  selectedCatIds: number[]
  hasChores?: boolean
  onClick: () => void
}

function DayCell({
  dateStr, events, activeFilters,
  isSelected, isInRange, feedingsPerDayMap, selectedCatIds, hasChores, onClick,
}: DayCellProps) {
  const today = getToday()
  const isToday = dateStr === today
  const isFuture = dateStr > today

  // Check missing feedings across tracked cats
  const trackedCats = selectedCatIds.length > 0
    ? selectedCatIds.filter(id => (feedingsPerDayMap.get(id) ?? 0) > 0)
    : [...feedingsPerDayMap.entries()].filter(([, fpd]) => fpd > 0).map(([id]) => id)

  const missingFeeding = !isFuture && isInRange && trackedCats.some(catId => {
    const required = feedingsPerDayMap.get(catId) ?? 0
    if (required === 0) return false
    const fed = events.filter(e => e.cat_id === catId && e.event_type === 'feeding').length
    return fed < required
  })

  // Group visible events by type for dots
  const visibleEvents = isInRange ? events.filter(e => activeFilters.has(e.event_type)) : []
  const typeGroups = new Map<EventType, number>()
  for (const e of visibleEvents) {
    typeGroups.set(e.event_type, (typeGroups.get(e.event_type) ?? 0) + 1)
  }
  const typesShown = [...typeGroups.entries()]
  const MAX_DOTS = 5
  const shown = typesShown.slice(0, MAX_DOTS)
  const overflow = typesShown.length - MAX_DOTS

  const dayNum = Number(dateStr.split('-')[2])

  // Cell background — no borders, state communicated through fill only
  const cellBg =
    !isInRange          ? 'bg-transparent cursor-default opacity-40' :
    isSelected && isToday ? 'bg-sky-100/90 dark:bg-sky-900/40 cursor-pointer' :
    isSelected          ? 'bg-primary/10 dark:bg-primary/15 cursor-pointer' :
    isToday             ? 'bg-sky-50/80 dark:bg-sky-950/40 cursor-pointer' :
                          'bg-muted/20 hover:bg-muted/50 cursor-pointer'

  return (
    <button
      onClick={onClick}
      disabled={!isInRange}
      aria-pressed={isSelected}
      aria-label={`${dateStr}${isInRange ? `, ${visibleEvents.length} events` : ''}`}
      className={[
        'relative flex flex-col items-start rounded-xl text-left transition-colors',
        'min-h-[64px] sm:min-h-[88px] w-full p-1.5 sm:p-2.5',
        cellBg,
      ].join(' ')}
    >
      {/* Day number — filled circle only for today/selected */}
      <span className={[
        'text-xs sm:text-sm font-semibold w-6 h-6 flex items-center justify-center rounded-full shrink-0 leading-none',
        isToday             ? 'bg-sky-500 text-white' :
        isSelected          ? 'bg-primary text-primary-foreground' :
        isInRange           ? 'text-foreground' :
                              'text-muted-foreground',
      ].join(' ')}>
        {dayNum}
      </span>

      {/* Event type dots + chore indicator — pushed to bottom of cell */}
      {isInRange && (shown.length > 0 || hasChores) && (
        <div className="flex flex-wrap gap-1 mt-auto pt-1">
          {shown.map(([type]) => (
            <span
              key={type}
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: EVENT_COLORS[type] }}
            />
          ))}
          {overflow > 0 && (
            <span className="text-[9px] text-muted-foreground leading-none self-center">+{overflow}</span>
          )}
          {hasChores && (
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ background: '#6366f1' }}
              title="Household chores"
            />
          )}
        </div>
      )}

      {/* Missing feeding indicator — amber corner notch */}
      {missingFeeding && (
        <span
          className="absolute bottom-0 right-0 w-0 h-0"
          style={{
            borderStyle: 'solid',
            borderWidth: '0 0 8px 8px',
            borderColor: 'transparent transparent #f59e0b transparent',
          }}
          aria-hidden="true"
        />
      )}

      {/* Lock icon for out-of-tier past days */}
      {!isInRange && !isFuture && (
        <Lock className="absolute top-1.5 right-1.5 w-3 h-3 text-muted-foreground/40" />
      )}
    </button>
  )
}

// ─── Sub-component: Day detail panel ─────────────────────────────────────────

interface DayPanelProps {
  dateStr: string
  events: CareEvent[]
  catMap: Map<number, Cat>
  catIndexMap: Map<number, number>
  memberMap: Map<number, string>
  activeFilters: Set<EventType>
  activeCats: Cat[]
  onClose: () => void
  onEdit: (event: CareEvent) => void
  onLogCare: (date: string, cat?: Cat) => void
  // Chores
  dayChores: HouseholdChore[]
  choreDefinitions: HouseholdChoreDefinition[]
  onLogChore: () => void
  onEditChore: (chore: HouseholdChore) => void
  onDeleteChore: (id: number) => void
}

function DayPanel({
  dateStr, events, catMap, catIndexMap, memberMap,
  activeFilters, activeCats, onClose, onEdit, onLogCare,
  dayChores, choreDefinitions, onLogChore, onEditChore, onDeleteChore,
}: DayPanelProps) {
  const [catPickerOpen, setCatPickerOpen] = useState(false)
  const visibleEvents = events.filter(e => activeFilters.has(e.event_type))

  const choreDefMap = useMemo(() => {
    const map = new Map<number, HouseholdChoreDefinition>()
    for (const d of choreDefinitions) map.set(d.id, d)
    return map
  }, [choreDefinitions])

  // Group by cat_id, then sort by occurred_at within each group
  const grouped = useMemo(() => {
    const map = new Map<number, CareEvent[]>()
    for (const e of visibleEvents) {
      const arr = map.get(e.cat_id) ?? []
      arr.push(e)
      map.set(e.cat_id, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
    }
    return map
  }, [visibleEvents])

  const handleLogCare = useCallback(() => {
    if (activeCats.length === 1) {
      onLogCare(dateStr, activeCats[0])
    } else {
      setCatPickerOpen(prev => !prev)
    }
  }, [activeCats, dateStr, onLogCare])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
        <div>
          <p className="text-sm font-semibold text-foreground">{formatDayLabel(dateStr)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {visibleEvents.length === 0
              ? 'No events logged'
              : `${visibleEvents.length} event${visibleEvents.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Event list + chores — both scroll together inside the fixed-height container */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-4">
        {visibleEvents.length === 0 && dayChores.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <CalendarDays className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No events on this day</p>
          </div>
        )}

        {[...grouped.entries()].map(([catId, catEvents]) => {
          const cat = catMap.get(catId)
          const catIdx = catIndexMap.get(catId) ?? 0
          const color = catAvatarColor(catIdx)
          return (
            <div key={catId}>
              {/* Cat header */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ background: color }}
                >
                  {(cat?.name ?? '?')[0].toUpperCase()}
                </span>
                <span className="text-xs font-semibold text-foreground">{cat?.name ?? `Cat ${catId}`}</span>
              </div>

              {/* Events for this cat */}
              <div className="space-y-1.5 pl-7">
                {catEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 group"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                      style={{ background: EVENT_COLORS[event.event_type] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-medium text-foreground truncate">
                          {EVENT_LABELS[event.event_type]}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">{formatTime(event.occurred_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{formatEventSummary(event)}</p>
                      {event.notes && (
                        <p className="text-xs text-muted-foreground/70 italic truncate">{event.notes}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60">
                        by {memberMap.get(event.logged_by_id) ?? 'Unknown'}
                      </p>
                    </div>
                    <button
                      onClick={() => onEdit(event)}
                      className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      aria-label={`Edit ${EVENT_LABELS[event.event_type]} event`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Household chores — inside the scrollable area so they don't crowd events out */}
        {dayChores.length > 0 && (
          <div className="border-t border-border/40 pt-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Household chores
            </p>
            <div className="space-y-1.5">
              {[...dayChores]
                .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
                .map(chore => {
                  const def = choreDefMap.get(chore.chore_definition_id)
                  return (
                    <div key={chore.id} className="flex items-start gap-2 group">
                      {def?.emoji ? (
                        <span className="text-sm shrink-0 mt-0.5 leading-none">{def.emoji}</span>
                      ) : (
                        <span className="w-2 h-2 rounded-sm shrink-0 mt-1.5 bg-indigo-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-medium text-foreground truncate">
                            {def?.name ?? 'Chore'}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatTime(chore.occurred_at)}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60">
                          by {memberMap.get(chore.logged_by_id) ?? 'Unknown'}
                        </p>
                        {chore.notes && (
                          <p className="text-xs text-muted-foreground/70 italic truncate">{chore.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => onEditChore(chore)}
                        className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Edit chore"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDeleteChore(chore.id)}
                        className="shrink-0 p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Delete chore"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>

      {/* Footer: log care + log chore */}
      <div className="shrink-0 px-4 py-3 border-t border-border/60 space-y-2">
        {catPickerOpen && activeCats.length > 1 && (
          <div className="mb-2">
            <p className="text-xs text-muted-foreground mb-1.5">Which cat?</p>
            <div className="flex flex-wrap gap-1.5">
              {activeCats.map((cat, idx) => (
                <button
                  key={cat.id}
                  onClick={() => { setCatPickerOpen(false); onLogCare(dateStr, cat) }}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ background: catAvatarColor(idx) }}
                  >
                    {cat.name[0].toUpperCase()}
                  </span>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={handleLogCare}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log care for {new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </button>
        {choreDefinitions.length > 0 && (
          <button
            onClick={onLogChore}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Log chore
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function HouseholdCalendarPage() {
  usePageTitle('Care Calendar')
  const { householdId } = useParams<{ householdId: string }>()
  const tier = useEffectiveTier()

  const queryClient = useQueryClient()

  // ── Display state ──────────────────────────────────────────────────────────
  const [displayMonth, setDisplayMonth] = useState<MonthYear>(currentMonthYear)
  const [selectedDate, setSelectedDate]  = useState<string | null>(null)
  const [selectedCatIds, setSelectedCatIds] = useState<number[]>([])       // empty = all
  const [activeTypeFilters, setActiveTypeFilters] = useState<Set<EventType>>(new Set(ALL_EVENT_TYPES))
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const [logModal, setLogModal] = useState<LogModalState>({ open: false })

  // ── Chore state ────────────────────────────────────────────────────────────
  const [chorePickerDate, setChorePickerDate] = useState<string | null>(null)
  const [editingCalendarChore, setEditingCalendarChore] = useState<HouseholdChore | null>(null)
  const [editCalChoreOccurredAt, setEditCalChoreOccurredAt] = useState('')
  const [editCalChoreNotes, setEditCalChoreNotes] = useState('')
  const [deletingCalChoreId, setDeletingCalChoreId] = useState<number | null>(null)

  // ── Data ───────────────────────────────────────────────────────────────────
  const householdQuery = useQuery({
    queryKey: ['household', Number(householdId)],
    queryFn: () => api.getHousehold(Number(householdId)),
    enabled: !!householdId,
    staleTime: 5 * 60 * 1000,
  })

  const catsQuery = useQuery({
    queryKey: ['cats', Number(householdId)],
    queryFn: () => api.getCats(Number(householdId)),
    enabled: !!householdId,
    staleTime: 5 * 60 * 1000,
  })

  const eventsQuery = useQuery({
    queryKey: ['care_events', Number(householdId), 'calendar', displayMonth.year, displayMonth.month],
    queryFn: () => api.getCareEvents(Number(householdId), {
      startDate: toMonthStart(displayMonth),
      endDate: toMonthEnd(displayMonth),
    }),
    enabled: !!householdId && tier !== 'free',
    staleTime: 2 * 60 * 1000,
  })

  const choreDefsQuery = useQuery({
    queryKey: ['household_chore_definitions', Number(householdId)],
    queryFn: () => api.getHouseholdChoreDefinitions(Number(householdId)),
    enabled: !!householdId && tier !== 'free',
    staleTime: 5 * 60 * 1000,
  })

  const choreQuery = useQuery({
    queryKey: ['household_chores', Number(householdId), 'calendar', displayMonth.year, displayMonth.month],
    queryFn: () => api.getHouseholdChores(Number(householdId), {
      startDate: toMonthStart(displayMonth),
      endDate: toMonthEnd(displayMonth),
    }),
    enabled: !!householdId && tier !== 'free',
    staleTime: 2 * 60 * 1000,
  })

  // ── Derived data ───────────────────────────────────────────────────────────
  const household = householdQuery.data?.data?.data as Household | undefined
  const cats: Cat[] = useMemo(() => {
    const raw = catsQuery.data?.data?.data
    return Array.isArray(raw) ? raw.filter((c: Cat) => c.active) : []
  }, [catsQuery.data])

  const allEvents: CareEvent[] = useMemo(() => {
    const raw = eventsQuery.data?.data?.data
    return Array.isArray(raw) ? raw : []
  }, [eventsQuery.data])

  const memberMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const m of household?.members ?? []) map.set(m.id, m.name)
    return map
  }, [household])

  const catMap = useMemo(() => {
    const map = new Map<number, Cat>()
    for (const c of cats) map.set(c.id, c)
    return map
  }, [cats])

  // Stable index per cat for avatar colours
  const catIndexMap = useMemo(() => {
    const map = new Map<number, number>()
    cats.forEach((c, i) => map.set(c.id, i))
    return map
  }, [cats])

  // Feedings-per-day per cat (for missing feeding indicator)
  const feedingsPerDayMap = useMemo(() => {
    const map = new Map<number, number>()
    for (const c of cats) {
      if ((c.feedings_per_day ?? 0) > 0) map.set(c.id, c.feedings_per_day ?? 1)
    }
    return map
  }, [cats])

  // Chore definitions (active only)
  const choreDefinitions: HouseholdChoreDefinition[] = useMemo(() => {
    const raw = choreDefsQuery.data?.data?.data
    return Array.isArray(raw) ? (raw as HouseholdChoreDefinition[]).filter(d => d.active) : []
  }, [choreDefsQuery.data])

  // All chores for the displayed month
  const monthChores: HouseholdChore[] = useMemo(() => {
    const raw = choreQuery.data?.data?.data
    return Array.isArray(raw) ? (raw as HouseholdChore[]) : []
  }, [choreQuery.data])

  // Map: date string → chore instances on that day
  const choresByDate = useMemo(() => {
    const map = new Map<string, HouseholdChore[]>()
    for (const c of monthChores) {
      const dateStr = new Date(c.occurred_at).toLocaleDateString('en-CA')
      const arr = map.get(dateStr) ?? []
      arr.push(c)
      map.set(dateStr, arr)
    }
    return map
  }, [monthChores])

  // Which cats are active in the filter (or all if none selected)
  const activeCats = useMemo(
    () => selectedCatIds.length > 0 ? cats.filter(c => selectedCatIds.includes(c.id)) : cats,
    [cats, selectedCatIds],
  )

  // Apply all client-side filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter(e => {
      if (selectedCatIds.length > 0 && !selectedCatIds.includes(e.cat_id)) return false
      if (!activeTypeFilters.has(e.event_type)) return false
      if (selectedMemberId !== null && e.logged_by_id !== selectedMemberId) return false
      return true
    })
  }, [allEvents, selectedCatIds, activeTypeFilters, selectedMemberId])

  // Group filtered events by date string
  const dayMap = useMemo(() => {
    const map = new Map<string, CareEvent[]>()
    for (const e of filteredEvents) {
      const dateStr = new Date(e.occurred_at).toLocaleDateString('en-CA')
      const arr = map.get(dateStr) ?? []
      arr.push(e)
      map.set(dateStr, arr)
    }
    return map
  }, [filteredEvents])

  // Event types that actually have data in this month (for the filter pills)
  const presentTypes = useMemo(() => {
    const seen = new Set<EventType>()
    for (const e of allEvents) seen.add(e.event_type)
    return ALL_EVENT_TYPES.filter(t => seen.has(t))
  }, [allEvents])

  // Calendar grid cells
  const calendarDays = useMemo(() => buildDays(displayMonth), [displayMonth])

  // Date range in this month that is within tier limits
  const monthStart = toMonthStart(displayMonth)
  const monthEnd   = toMonthEnd(displayMonth)
  const todayStr   = getToday()

  // ── Navigation ─────────────────────────────────────────────────────────────
  const atTierLimit = !canGoBack(displayMonth, tier)
  const atFuture    = isCurrentOrFuture(displayMonth)

  const handlePrev = useCallback(() => {
    if (!canGoBack(displayMonth, tier)) return
    setDisplayMonth(m => prevMonth(m))
    setSelectedDate(null)
  }, [displayMonth, tier])

  const handleNext = useCallback(() => {
    if (atFuture) return
    setDisplayMonth(m => nextMonth(m))
    setSelectedDate(null)
  }, [atFuture])

  // Reset selected date when month changes
  useEffect(() => { setSelectedDate(null) }, [displayMonth])

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const handleEdit = useCallback((event: CareEvent) => {
    const cat = catMap.get(event.cat_id)
    if (!cat) return
    setLogModal({ open: true, cat, date: selectedDate!, event })
  }, [catMap, selectedDate])

  const handleLogCare = useCallback((date: string, cat?: Cat) => {
    const targetCat = cat ?? (activeCats.length > 0 ? activeCats[0] : undefined)
    if (!targetCat) return
    setLogModal({ open: true, cat: targetCat, date })
  }, [activeCats])

  // ── Chore mutations ────────────────────────────────────────────────────────
  const choreQueryKey = ['household_chores', Number(householdId), 'calendar', displayMonth.year, displayMonth.month]

  const createChoreMutation = useMutation({
    mutationFn: ({ definitionId, date }: { definitionId: number; date: string }) =>
      api.createHouseholdChore(Number(householdId), {
        household_chore: {
          chore_definition_id: definitionId,
          occurred_at: new Date(`${date}T12:00:00`).toISOString(),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreQueryKey })
      setChorePickerDate(null)
      notify.success('Chore logged.')
    },
    onError: () => notify.error('Failed to log chore.'),
  })

  const updateChoreMutation = useMutation({
    mutationFn: ({ id, occurred_at, notes }: { id: number; occurred_at: string; notes: string | null }) =>
      api.updateHouseholdChore(Number(householdId), id, {
        household_chore: { occurred_at, notes: notes || null },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreQueryKey })
      setEditingCalendarChore(null)
      notify.success('Chore updated.')
    },
    onError: () => notify.error('Failed to update chore.'),
  })

  const deleteChoreMutation = useMutation({
    mutationFn: (id: number) => api.deleteHouseholdChore(Number(householdId), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreQueryKey })
      setDeletingCalChoreId(null)
      notify.success('Chore entry deleted.')
    },
    onError: () => notify.error('Failed to delete chore.'),
  })

  function handleEditChore(chore: HouseholdChore) {
    setEditingCalendarChore(chore)
    const d = new Date(chore.occurred_at)
    const pad = (n: number) => String(n).padStart(2, '0')
    setEditCalChoreOccurredAt(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    )
    setEditCalChoreNotes(chore.notes ?? '')
  }

  function handleSaveChoreEdit() {
    if (!editingCalendarChore) return
    updateChoreMutation.mutate({
      id: editingCalendarChore.id,
      occurred_at: new Date(editCalChoreOccurredAt).toISOString(),
      notes: editCalChoreNotes || null,
    })
  }

  // ── Tier gate ──────────────────────────────────────────────────────────────
  if (tier === 'free') {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <PageHeader title="Care Calendar" subtitle="Monthly household care overview" />
        <div className="mt-12 flex flex-col items-center gap-4 text-center py-16 border border-dashed border-border rounded-2xl bg-muted/20">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Lock className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">Calendar view requires Pro or Premium</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Upgrade to see your full care history in a monthly calendar, filter by cat and event type, and log care directly from any day.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const selectedDayEvents = selectedDate ? (dayMap.get(selectedDate) ?? []) : []

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div className="container mx-auto max-w-screen-xl px-4 py-3">
          {/* Row 1: title + month nav */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold text-foreground">Care Calendar</h1>
            </div>

            {/* Month navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={atTierLimit}
                aria-label="Previous month"
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                  atTierLimit
                    ? 'text-muted-foreground/30 cursor-not-allowed'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {atTierLimit ? <Lock className="w-3.5 h-3.5" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
              <span className="text-sm font-semibold text-foreground min-w-32 text-center">
                {monthLabel(displayMonth)}
              </span>
              <button
                onClick={handleNext}
                disabled={atFuture}
                aria-label="Next month"
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                  atFuture
                    ? 'text-muted-foreground/30 cursor-not-allowed'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Row 2: filters */}
          <div className="mt-2.5 flex flex-col gap-2">
            {/* Cat filter pills */}
            {cats.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setSelectedCatIds([])}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    selectedCatIds.length === 0
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All cats
                </button>
                {cats.map((cat, idx) => {
                  const active = selectedCatIds.includes(cat.id)
                  const color = catAvatarColor(idx)
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCatIds(prev =>
                          active ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                        )
                        setSelectedDate(null)
                      }}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? 'border-transparent text-white'
                          : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground'
                      }`}
                      style={active ? { background: color, borderColor: color } : undefined}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                        style={{ background: active ? 'rgba(255,255,255,0.3)' : color, color: active ? 'white' : 'white' }}
                      >
                        {cat.name[0].toUpperCase()}
                      </span>
                      {cat.name}
                    </button>
                  )
                })}

                {/* Member filter */}
                {household && household.members.length > 1 && (
                  <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border/60">
                    <span className="text-xs text-muted-foreground">By:</span>
                    <select
                      value={selectedMemberId ?? ''}
                      onChange={e => setSelectedMemberId(e.target.value ? Number(e.target.value) : null)}
                      className="text-xs bg-transparent border-none outline-none text-foreground cursor-pointer"
                    >
                      <option value="">Anyone</option>
                      {household.members.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Event type filter */}
            <TypeFilter
              presentTypes={presentTypes}
              activeFilters={activeTypeFilters}
              onToggle={t => setActiveTypeFilters(prev => {
                const next = new Set(prev)
                if (next.has(t)) next.delete(t); else next.add(t)
                return next
              })}
              onAll={() => setActiveTypeFilters(new Set(ALL_EVENT_TYPES))}
            />
          </div>
        </div>
      </div>

      {/* ── Main content: calendar + panel ───────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Calendar grid */}
        <div className="flex-1 min-w-0 overflow-auto">
          <div className="container mx-auto max-w-screen-xl px-4 py-4">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-2 mb-1">
              {WEEKDAY_LABELS.map(d => (
                <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{d.slice(0, 1)}</span>
                </div>
              ))}
            </div>

            {/* Loading state */}
            {eventsQuery.isLoading && (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="min-h-[64px] sm:min-h-[88px] rounded-xl bg-muted/40 animate-pulse" />
                ))}
              </div>
            )}

            {/* Calendar cells */}
            {!eventsQuery.isLoading && (
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((dateStr, i) => {
                  if (!dateStr) {
                    return <div key={i} className="min-h-[64px] sm:min-h-[88px]" />
                  }
                  const isInRange = dateStr >= monthStart && dateStr <= monthEnd && dateStr <= todayStr
                  return (
                    <DayCell
                      key={dateStr}
                      dateStr={dateStr}
                      events={dayMap.get(dateStr) ?? []}
                      activeFilters={activeTypeFilters}
                      isSelected={selectedDate === dateStr}
                      isInRange={isInRange}
                      feedingsPerDayMap={feedingsPerDayMap}
                      selectedCatIds={selectedCatIds}
                      hasChores={(choresByDate.get(dateStr)?.length ?? 0) > 0}
                      onClick={() => {
                        if (!isInRange) return
                        setSelectedDate(prev => prev === dateStr ? null : dateStr)
                      }}
                    />
                  )
                })}
              </div>
            )}

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
              {cats.some(c => (c.feedings_per_day ?? 0) > 0) && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="inline-block w-0 h-0"
                    style={{
                      borderStyle: 'solid',
                      borderWidth: '0 0 10px 10px',
                      borderColor: 'transparent transparent #f59e0b transparent',
                    }}
                    aria-hidden="true"
                  />
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  Missing feeding
                </div>
              )}
              {choreDefinitions.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 shrink-0" aria-hidden="true" />
                  Household chores
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right panel (desktop) ─────────────────────────────────────────── */}
        {selectedDate && (
          <div className="hidden lg:flex w-80 shrink-0 flex-col border-l border-border/60 bg-background overflow-hidden">
            <DayPanel
              dateStr={selectedDate}
              events={selectedDayEvents}
              catMap={catMap}
              catIndexMap={catIndexMap}
              memberMap={memberMap}
              activeFilters={activeTypeFilters}
              activeCats={activeCats}
              onClose={() => setSelectedDate(null)}
              onEdit={handleEdit}
              onLogCare={handleLogCare}
              dayChores={choresByDate.get(selectedDate) ?? []}
              choreDefinitions={choreDefinitions}
              onLogChore={() => setChorePickerDate(selectedDate)}
              onEditChore={handleEditChore}
              onDeleteChore={id => setDeletingCalChoreId(id)}
            />
          </div>
        )}
      </div>

      {/* ── Bottom sheet (mobile / tablet) ───────────────────────────────────── */}
      {selectedDate && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden bg-background border-t border-border/60 rounded-t-2xl shadow-2xl max-h-[60dvh]">
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>
          <DayPanel
            dateStr={selectedDate}
            events={selectedDayEvents}
            catMap={catMap}
            catIndexMap={catIndexMap}
            memberMap={memberMap}
            activeFilters={activeTypeFilters}
            activeCats={activeCats}
            onClose={() => setSelectedDate(null)}
            onEdit={handleEdit}
            onLogCare={handleLogCare}
            dayChores={choresByDate.get(selectedDate) ?? []}
            choreDefinitions={choreDefinitions}
            onLogChore={() => setChorePickerDate(selectedDate)}
            onEditChore={handleEditChore}
            onDeleteChore={id => setDeletingCalChoreId(id)}
          />
        </div>
      )}

      {/* ── LogCareModal ─────────────────────────────────────────────────────── */}
      {logModal.open && (
        <LogCareModal
          cat={logModal.cat}
          householdId={Number(householdId)}
          initialEvent={logModal.event}
          initialDate={logModal.event ? undefined : logModal.date}
          onClose={() => setLogModal({ open: false })}
        />
      )}

      {/* ── Chore picker: select which chore to log for a date ───────────────── */}
      <Dialog
        open={chorePickerDate !== null}
        onOpenChange={open => { if (!open) setChorePickerDate(null) }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              Log chore for{' '}
              {chorePickerDate
                ? new Date(`${chorePickerDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="py-1 space-y-1.5">
            {choreDefinitions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No active chore definitions. Add some in Household Settings.
              </p>
            ) : (
              choreDefinitions.map(def => (
                <button
                  key={def.id}
                  onClick={() => {
                    if (chorePickerDate) {
                      createChoreMutation.mutate({ definitionId: def.id, date: chorePickerDate })
                    }
                  }}
                  disabled={createChoreMutation.isPending}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                >
                  {def.emoji && (
                    <span className="text-base leading-none shrink-0">{def.emoji}</span>
                  )}
                  <span className="text-sm font-medium">{def.name}</span>
                  {def.frequency_per_day > 1 && (
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">
                      {def.frequency_per_day}× per day
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Chore edit dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={editingCalendarChore !== null}
        onOpenChange={open => { if (!open) setEditingCalendarChore(null) }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Edit chore entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Time</label>
              <input
                type="datetime-local"
                value={editCalChoreOccurredAt}
                onChange={e => setEditCalChoreOccurredAt(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={editCalChoreNotes}
                onChange={e => setEditCalChoreNotes(e.target.value)}
                rows={2}
                placeholder="Any notes..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={handleSaveChoreEdit} disabled={updateChoreMutation.isPending}>
              {updateChoreMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Chore delete confirmation ────────────────────────────────────────── */}
      <AlertDialog
        open={deletingCalChoreId !== null}
        onOpenChange={open => { if (!open) setDeletingCalChoreId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chore entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingCalChoreId !== null && deleteChoreMutation.mutate(deletingCalChoreId)}
              disabled={deleteChoreMutation.isPending}
            >
              {deleteChoreMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
