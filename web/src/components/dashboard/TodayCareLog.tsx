import { useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Plus } from 'lucide-react'
import { isToday, formatTime, formatEventSummary, EVENT_TYPE_LABEL } from '@/lib/helpers'
import type { Cat, CareEvent, EventType } from '@/types/api'

const EVENT_EMOJI: Record<EventType, string> = {
  feeding: '🍽️',
  water: '💧',
  litter: '🧹',
  weight: '⚖️',
  medication: '💊',
  vet_visit: '🩺',
  grooming: '✂️',
  note: '📝',
}

interface TodayCareLogProps {
  todayEvents: CareEvent[]
  selectedDate: Date
  onPrevDay: () => void
  onNextDay: () => void
  cats: Cat[]
  memberMap: Map<number, string>
  currentUserId: number
  onEdit: (event: CareEvent) => void
  onRefresh: () => void
  isRefreshing: boolean
  onQuickLog: (cat: Cat) => void
  onGoToToday: () => void
}

function getDateLabel(date: Date): string {
  if (isToday(date.toISOString())) return 'Today'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday'
  }
  return date.toLocaleDateString([], { month: 'long', day: 'numeric' })
}

export function TodayCareLog({
  todayEvents,
  selectedDate,
  onPrevDay,
  onNextDay,
  cats,
  memberMap,
  currentUserId,
  onEdit,
  onRefresh,
  isRefreshing,
  onQuickLog,
  onGoToToday,
}: TodayCareLogProps) {
  const [showCatPicker, setShowCatPicker] = useState(false)
  const viewingToday = isToday(selectedDate.toISOString())
  const dateLabel = getDateLabel(selectedDate)

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          {/* Section label */}
          <span className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            Activity
          </span>
          <span className="text-muted-foreground/40 text-xs">·</span>
          {/* Date nav */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={onPrevDay}
              className="flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            {viewingToday ? (
              <span className="text-xs font-medium px-0.5 min-w-[64px] text-center">
                {dateLabel}
              </span>
            ) : (
              <button
                onClick={onGoToToday}
                className="text-xs font-medium px-0.5 min-w-[64px] text-center text-sky-600 dark:text-sky-400 hover:underline"
                title="Jump to today"
              >
                {dateLabel}
              </button>
            )}
            <button
              onClick={onNextDay}
              disabled={viewingToday}
              className="flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next day"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {todayEvents.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {todayEvents.length} {todayEvents.length === 1 ? 'event' : 'events'}
            </span>
          )}
          {cats.length > 0 && (
            <button
              onClick={() => setShowCatPicker((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Log care event"
            >
              <Plus className="size-3.5" />
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            aria-label="Refresh care log"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Inline cat picker */}
      {showCatPicker && (
        <div className="flex flex-wrap gap-1.5 px-4 py-2.5 border-b border-border/40 bg-muted/30">
          <span className="text-xs text-muted-foreground self-center mr-0.5">Log for:</span>
          {cats.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setShowCatPicker(false)
                onQuickLog(cat)
              }}
              className="px-2.5 py-1 rounded-full text-xs font-medium border border-border hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700 dark:hover:bg-sky-950/20 dark:hover:border-sky-700 dark:hover:text-sky-400 transition-colors"
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {todayEvents.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing logged {viewingToday ? 'today' : `on ${dateLabel}`}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {todayEvents.map((event) => {
            const cat = cats.find((c) => c.id === event.cat_id)
            const loggedBy = memberMap.get(event.logged_by_id)
            const byLabel =
              event.logged_by_id === currentUserId ? 'You' : (loggedBy ?? 'Someone')
            const summary = formatEventSummary(event)

            return (
              <button
                key={event.id}
                onClick={() => onEdit(event)}
                className="w-full px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start gap-3">
                  <span className="text-base shrink-0 mt-px select-none">
                    {EVENT_EMOJI[event.event_type] ?? '📋'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug truncate">
                      {EVENT_TYPE_LABEL[event.event_type]}
                      {cat ? ` · ${cat.name}` : ''}
                      {summary ? ` · ${summary}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {byLabel} · {formatTime(event.occurred_at)}
                    </p>
                    {event.notes && (
                      <p className="mt-0.5 text-xs italic text-muted-foreground truncate">
                        "{event.notes}"
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
