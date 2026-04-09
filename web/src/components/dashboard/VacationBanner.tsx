import { useState } from 'react'
import { Plane, Clock, X, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { VacationTrip, CareEvent, MemberRole } from '@/types/api'

interface VacationBannerProps {
  trip: VacationTrip
  householdId: number
  allEvents: CareEvent[]
  memberRoleMap: Map<number, MemberRole>
  currentRole: MemberRole | null
}

function formatTripDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function VacationBanner({
  trip,
  householdId,
  allEvents,
  memberRoleMap,
  currentRole,
}: VacationBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  // Find the most recent event logged by a sitter on or after the trip start
  const tripStartMs = new Date(trip.start_date + 'T00:00:00').getTime()
  const lastSitterEvent = allEvents
    .filter((e) => {
      const role = memberRoleMap.get(e.logged_by_id)
      return role === 'sitter' && new Date(e.occurred_at).getTime() >= tripStartMs
    })
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())[0]

  const endLabel = trip.end_date ? formatTripDate(trip.end_date) : 'ongoing'
  const dateRange = `${formatTripDate(trip.start_date)} – ${endLabel}`
  const freqLabel =
    trip.sitter_visit_frequency_days === 1
      ? 'daily'
      : `every ${trip.sitter_visit_frequency_days} days`

  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-200 dark:border-sky-800/30 bg-gradient-to-br from-sky-50 via-cyan-50 to-teal-50/80 dark:from-sky-950/25 dark:via-cyan-950/20 dark:to-teal-950/10 p-4 shadow-sm">
      {/* Decorative background accent */}
      <span
        aria-hidden="true"
        className="pointer-events-none select-none absolute -right-2 -top-3 text-6xl opacity-[0.07]"
      >
        ✈️
      </span>

      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors"
        aria-label="Dismiss vacation banner"
      >
        <X className="size-3.5" />
      </button>

      <div className="space-y-3 pr-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/40">
            <Plane className="size-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sky-700 dark:text-sky-300 leading-tight">
              Vacation Mode Active
            </p>
            <p className="text-xs text-sky-500 dark:text-sky-400/80">
              {dateRange}
            </p>
          </div>
        </div>

        {/* Info row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg bg-white/50 dark:bg-white/5 border border-sky-100 dark:border-sky-800/20 px-3 py-1.5">
            <Clock className="size-3.5 text-sky-500 dark:text-sky-400 shrink-0" />
            <span className="text-xs text-sky-700 dark:text-sky-300">
              Sitter visits {freqLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg bg-white/50 dark:bg-white/5 border border-sky-100 dark:border-sky-800/20 px-3 py-1.5">
            <span className="text-xs text-sky-700 dark:text-sky-300">
              {lastSitterEvent
                ? `Last sitter visit: ${formatTimeAgo(lastSitterEvent.occurred_at)}`
                : 'No sitter visit yet'}
            </span>
          </div>
        </div>

        {/* Notes (if any) */}
        {trip.notes && (
          <p className="text-xs text-sky-600 dark:text-sky-400 italic">
            {trip.notes}
          </p>
        )}

        {/* Admin link */}
        {currentRole === 'admin' && (
          <div className="flex items-center gap-1 pt-0.5">
            <Settings className="size-3 text-sky-400 dark:text-sky-500 shrink-0" />
            <Link
              to={`/households/${householdId}/vacation`}
              className="text-xs text-sky-500 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 underline underline-offset-2 transition-colors"
            >
              Manage trip
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
