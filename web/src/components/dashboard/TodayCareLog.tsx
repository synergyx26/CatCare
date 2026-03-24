import { ChevronLeft, ChevronRight, ClipboardList, RefreshCw } from 'lucide-react'
import { isToday, formatTime, formatEventSummary, EVENT_TYPE_LABEL } from '@/lib/helpers'
import { EVENT_COLORS } from '@/lib/eventColors'
import type { Cat, CareEvent } from '@/types/api'

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
}: TodayCareLogProps) {
  const viewingToday = isToday(selectedDate.toISOString())
  const dateLabel = getDateLabel(selectedDate)

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <ClipboardList className="size-4 text-muted-foreground shrink-0" />
          <h2 className="text-sm font-semibold">Care log</h2>
          <span className="text-xs text-muted-foreground">·</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={onPrevDay}
              className="flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="text-xs font-medium tabular-nums px-0.5 min-w-[64px] text-center">
              {dateLabel}
            </span>
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

      {todayEvents.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing logged {viewingToday ? 'today' : `on ${dateLabel}`}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {todayEvents.map((event) => {
            const cat = cats.find((c) => c.id === event.cat_id)
            const loggedBy = memberMap.get(event.logged_by_id)
            const byLabel =
              event.logged_by_id === currentUserId ? 'You' : (loggedBy ?? 'Someone')
            const eventColor = EVENT_COLORS[event.event_type] ?? '#94a3b8'

            return (
              <button
                key={event.id}
                onClick={() => onEdit(event)}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: eventColor }}
                    />
                    <span className="w-11 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatTime(event.occurred_at)}
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {cat?.name ?? 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {EVENT_TYPE_LABEL[event.event_type]} · {byLabel}
                      </span>
                    </div>
                  </div>
                  {formatEventSummary(event) && (
                    <span className="shrink-0 text-xs text-muted-foreground font-medium">
                      {formatEventSummary(event)}
                    </span>
                  )}
                </div>
                {event.notes && (
                  <p className="mt-1 pl-[60px] text-xs italic text-muted-foreground truncate">
                    "{event.notes}"
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
