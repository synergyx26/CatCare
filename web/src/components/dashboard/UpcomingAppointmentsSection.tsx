import { useQuery } from '@tanstack/react-query'
import { Stethoscope, Scissors, CalendarPlus } from 'lucide-react'
import { api } from '@/api/client'
import { formatEventSummary } from '@/lib/helpers'
import type { Cat, CareEvent, EventType } from '@/types/api'

interface Props {
  householdId: number
  cats: Cat[]
  onSchedule: (cat: Cat, type: EventType) => void
}

function formatAppointmentDate(isoString: string): { relative: string; absolute: string } {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  let relative: string
  if (diffDays === 0) relative = 'Today'
  else if (diffDays === 1) relative = 'Tomorrow'
  else if (diffDays < 7) relative = `In ${diffDays} days`
  else if (diffDays < 14) relative = 'Next week'
  else relative = `In ${Math.ceil(diffDays / 7)} weeks`

  const absolute = date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }) + ' · ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return { relative, absolute }
}

export function UpcomingAppointmentsSection({ householdId, cats, onSchedule }: Props) {
  const { data } = useQuery({
    queryKey: ['upcoming_appointments', householdId],
    queryFn: () => api.getCareEvents(householdId, {
      upcoming: true,
      eventTypes: ['vet_visit', 'grooming'],
    }),
    staleTime: 60_000,
  })

  const appointments: CareEvent[] = data?.data?.data ?? []

  const defaultCat = cats[0]

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Upcoming Appointments</h3>
        {defaultCat && (
          <button
            onClick={() => onSchedule(defaultCat, 'vet_visit')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <CalendarPlus className="size-3.5" />
            Schedule
          </button>
        )}
      </div>

      {appointments.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No upcoming appointments.</p>
      ) : (
        <ul className="space-y-2">
          {appointments.map((event) => {
            const cat = cats.find((c) => c.id === event.cat_id)
            const { relative, absolute } = formatAppointmentDate(event.occurred_at)
            const isVet = event.event_type === 'vet_visit'

            return (
              <li key={event.id} className="flex items-start gap-3">
                <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                  isVet
                    ? 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400'
                    : 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                }`}>
                  {isVet
                    ? <Stethoscope className="size-3.5" />
                    : <Scissors className="size-3.5" />
                  }
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight truncate">
                    {cat?.name ?? 'Unknown'} · {formatEventSummary(event)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground">{relative}</span>
                    {' · '}{absolute}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
