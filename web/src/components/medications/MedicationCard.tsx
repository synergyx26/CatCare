import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { ChevronDown, ChevronUp, Pencil, Pill } from 'lucide-react'
import { api } from '@/api/client'
import { notify } from '@/lib/notify'
import { getNextDoseLabel, buildDoseTimeline, formatTime } from '@/lib/helpers'
import { FREQUENCY_LABELS } from '@/types/api'
import type { ApiError, CareEvent, MedicationFrequency } from '@/types/api'
import { AddMedicationModal } from './AddMedicationModal'
import { QuickLogDoseSheet } from './QuickLogDoseSheet'

function formatDayLabel(isoString: string): string {
  const d = new Date(isoString)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  ) return 'Today'
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

interface Props {
  householdId: number
  catId: number
  name: string
  /** The CareEvent with active_medication: true — the regimen start */
  startEvent: CareEvent
  /** All dose events for this medication (sorted newest-first) */
  doseHistory: CareEvent[]
  memberMap: Map<number, string>
  currentUserId: number
  isSitter: boolean
  /** Initially expanded (e.g. only one medication) */
  defaultExpanded?: boolean
}

export function MedicationCard({
  householdId,
  catId,
  name,
  startEvent,
  doseHistory,
  memberMap,
  currentUserId,
  isSitter,
  defaultExpanded = false,
}: Props) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded]   = useState(defaultExpanded)
  const [showLog, setShowLog]     = useState(false)
  const [showEdit, setShowEdit]   = useState(false)

  const d = startEvent.details as Record<string, unknown>
  const dosage    = d.dosage    as string | undefined
  const unit      = d.unit      as string | undefined
  const frequency = d.frequency as MedicationFrequency | undefined
  const courseEnd = d.course_end_date as string | undefined
  const stopped   = d.stopped === true

  const doseLabel    = dosage ? `${dosage} ${unit}` : null
  const freqLabel    = frequency ? FREQUENCY_LABELS[frequency] : null
  const startedLabel = new Date(startEvent.occurred_at).toLocaleDateString([], {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  // Most recent dose (excludes the start event itself)
  const lastDose = doseHistory[0]
  // Only compute next-due from an actual logged dose — the start event is not a dose,
  // so using startEvent.occurred_at as a fallback produces misleading overdue values.
  const nextDueLabel = lastDose ? getNextDoseLabel(frequency, lastDose.occurred_at) : null

  // Build unified timeline
  const timeline = buildDoseTimeline(
    frequency ?? null,
    startEvent.occurred_at,
    doseHistory
  )
  const visibleTimeline = timeline.slice(0, 14) // show last 14 rows max

  // Days remaining on a course
  let courseRemaining: string | null = null
  if (courseEnd && !stopped) {
    const daysLeft = Math.ceil(
      (new Date(courseEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    )
    if (daysLeft > 0) {
      courseRemaining = `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
    } else if (daysLeft === 0) {
      courseRemaining = 'Last day'
    } else {
      courseRemaining = 'Course complete'
    }
  }

  // ── Stop / Reactivate ──────────────────────────────────────────────────────

  const stopMutation = useMutation({
    mutationFn: () => {
      const existing = startEvent.details as Record<string, unknown>
      return api.updateCareEvent(householdId, startEvent.id, {
        care_event: { details: { ...existing, stopped: true } },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care_events'] })
      notify.success('Medication stopped')
    },
    onError: (err: AxiosError<ApiError>) => {
      notify.error(err.response?.data?.message ?? 'Failed to stop medication')
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: () => {
      const existing = startEvent.details as Record<string, unknown>
      const { stopped: _removed, ...rest } = existing as Record<string, unknown> & { stopped?: boolean }
      return api.updateCareEvent(householdId, startEvent.id, {
        care_event: { details: rest },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care_events'] })
      notify.success('Medication reactivated')
    },
    onError: (err: AxiosError<ApiError>) => {
      notify.error(err.response?.data?.message ?? 'Failed to reactivate medication')
    },
  })

  // ── Grouping helper ────────────────────────────────────────────────────────

  function groupLabel(row: typeof visibleTimeline[number]): string {
    const at = row.type === 'dose' ? row.event.occurred_at : row.expectedAt
    return formatDayLabel(at)
  }

  return (
    <>
      <div className={`rounded-2xl bg-card ring-1 shadow-sm overflow-hidden ${
        stopped
          ? 'ring-border/30 opacity-60'
          : 'ring-border/60'
      }`}>
        {/* ── Card header ───────────────────────────────────────────────────── */}
        <button
          className="w-full px-4 pt-3.5 pb-3 flex items-start justify-between gap-3 text-left"
          onClick={() => setExpanded((x) => !x)}
          aria-expanded={expanded}
          aria-controls={`med-card-body-${startEvent.id}`}
          aria-label={`${name}${expanded ? ', collapse' : ', expand'}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold text-sm ${stopped ? 'line-through text-muted-foreground' : ''}`}>
                {name.toUpperCase()}
              </span>
              {doseLabel && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {doseLabel}
                </span>
              )}
              {courseRemaining && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  courseRemaining === 'Course complete'
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  {courseRemaining}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              {freqLabel && (
                <span className="text-xs text-muted-foreground">{freqLabel}</span>
              )}
              {freqLabel && <span className="text-xs text-muted-foreground/40">·</span>}
              <span className="text-xs text-muted-foreground">Started {startedLabel}</span>
            </div>
            {!stopped && nextDueLabel && (
              <p className={`text-xs mt-1 font-medium ${
                nextDueLabel.startsWith('Overdue') || nextDueLabel === 'Due now'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-green-600 dark:text-green-400'
              }`}>
                {nextDueLabel}
              </p>
            )}
          </div>
          <div className="shrink-0 text-muted-foreground mt-0.5" aria-hidden="true">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </div>
        </button>

        {/* ── Expanded body ─────────────────────────────────────────────────── */}
        {expanded && (
          <div id={`med-card-body-${startEvent.id}`} className="border-t border-border/40">
            {/* Dose timeline */}
            <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto">
              {visibleTimeline.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">No doses logged yet.</p>
              ) : (() => {
                let lastDay = ''
                return visibleTimeline.map((row, i) => {
                  const day = groupLabel(row)
                  const showDay = day !== lastDay
                  lastDay = day

                  if (row.type === 'missed') {
                    return (
                      <div key={`missed-${i}`}>
                        {showDay && (
                          <p className="text-xs text-muted-foreground/60 font-medium mb-1 mt-2 first:mt-0">{day}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 py-0.5" role="alert">
                          <span aria-hidden="true" className="text-amber-500">⚠</span>
                          <span>
                            Expected ~{formatTime(row.expectedAt)} · No dose logged
                          </span>
                        </div>
                      </div>
                    )
                  }

                  const event = row.event
                  const who = event.logged_by_id === currentUserId
                    ? 'You'
                    : (memberMap.get(event.logged_by_id) ?? 'Someone')

                  return (
                    <div key={event.id}>
                      {showDay && (
                        <p className="text-xs text-muted-foreground/60 font-medium mb-1 mt-2 first:mt-0">{day}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs">
                        <Pill className="size-3 text-red-400 shrink-0" aria-hidden="true" />
                        <span className="text-foreground">{formatTime(event.occurred_at)}</span>
                        <span className="text-muted-foreground">· {who}</span>
                        {event.notes && (
                          <span className="text-muted-foreground truncate">· {event.notes}</span>
                        )}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>

            {/* Action row */}
            <div className="px-4 py-2.5 border-t border-border/40 flex items-center gap-3 bg-muted/20">
              {stopped ? (
                <>
                  {!isSitter && (
                    <button
                      onClick={() => reactivateMutation.mutate()}
                      disabled={reactivateMutation.isPending}
                      className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline disabled:opacity-40"
                    >
                      Reactivate
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowLog(true)}
                    className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline"
                  >
                    Log dose
                  </button>
                  {!isSitter && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <button
                        onClick={() => stopMutation.mutate()}
                        disabled={stopMutation.isPending}
                        className="text-xs text-muted-foreground hover:text-destructive hover:underline transition-colors disabled:opacity-40"
                      >
                        Stop
                      </button>
                      <span className="text-muted-foreground/40">·</span>
                      <button
                        onClick={() => setShowEdit(true)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                        aria-label={`Edit ${name} medication`}
                      >
                        <Pencil className="size-3" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {showLog && (
        <QuickLogDoseSheet
          catId={catId}
          householdId={householdId}
          startEvent={startEvent}
          onClose={() => setShowLog(false)}
        />
      )}

      {showEdit && (
        <AddMedicationModal
          catId={catId}
          householdId={householdId}
          editEvent={startEvent}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  )
}
