import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { ChevronDown, ChevronUp, PackageOpen, Pencil, Pill } from 'lucide-react'
import { api } from '@/api/client'
import { notify } from '@/lib/notify'
import { getNextDoseLabel, buildDoseTimeline, getCourseEndMs, isMedicationCourseOver, parseLocalDate, formatTime, getMedicationSupply, formatSupplyLabel } from '@/lib/helpers'
import { FREQUENCY_LABELS } from '@/types/api'
import type { ApiError, CareEvent, MedicationFrequency } from '@/types/api'
import { AddMedicationModal } from './AddMedicationModal'
import { QuickLogDoseSheet } from './QuickLogDoseSheet'
import { NewSupplySheet } from './NewSupplySheet'

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
  /** New-supply events (details.supply_refill) for this medication, on/after the start event */
  refills?: CareEvent[]
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
  refills = [],
  memberMap,
  currentUserId,
  isSitter,
  defaultExpanded = false,
}: Props) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded]   = useState(defaultExpanded)
  const [showLog, setShowLog]     = useState(false)
  const [showEdit, setShowEdit]   = useState(false)
  const [showNewSupply, setShowNewSupply] = useState(false)
  const [editingRefill, setEditingRefill] = useState<CareEvent | null>(null)

  const d = startEvent.details as Record<string, unknown>
  const dosage    = d.dosage    as string | undefined
  const unit      = d.unit      as string | undefined
  const frequency = d.frequency as MedicationFrequency | undefined
  const courseEnd = d.course_end_date as string | undefined
  const stopped   = d.stopped === true
  const courseOver = isMedicationCourseOver(d)

  const doseLabel    = dosage ? `${dosage} ${unit}` : null
  const freqLabel    = frequency ? FREQUENCY_LABELS[frequency] : null
  const startedLabel = new Date(startEvent.occurred_at).toLocaleDateString([], {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  // Most recent dose (excludes the start event itself)
  const lastDose = doseHistory[0]
  // Only compute next-due from an actual logged dose — the start event is not a dose,
  // so using startEvent.occurred_at as a fallback produces misleading overdue values.
  const nextDueLabel = lastDose && !stopped && !courseOver ? getNextDoseLabel(frequency, lastDose.occurred_at) : null

  // Build unified timeline
  const timeline = buildDoseTimeline(
    frequency ?? null,
    startEvent.occurred_at,
    doseHistory,
    getCourseEndMs(d),
  )
  // New-supply entries interleaved with doses/missed markers, newest first
  type Row = typeof timeline[number] | { type: 'refill'; event: CareEvent }
  const rowTime = (row: Row) => row.type === 'missed' ? row.expectedAt : row.event.occurred_at
  const visibleTimeline: Row[] = [
    ...timeline,
    ...refills.map((event) => ({ type: 'refill' as const, event })),
  ]
    .sort((a, b) => new Date(rowTime(b)).getTime() - new Date(rowTime(a)).getTime())
    .slice(0, 14) // show last 14 rows max

  const supply = getMedicationSupply(startEvent, doseHistory, refills)

  // Days remaining on a course
  let courseRemaining: string | null = null
  if (courseEnd && !stopped) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysLeft = Math.round(
      (parseLocalDate(courseEnd).getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
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

  function groupLabel(row: Row): string {
    return formatDayLabel(rowTime(row))
  }

  function memberLabel(event: CareEvent): string {
    return event.logged_by_id === currentUserId
      ? 'You'
      : (memberMap.get(event.logged_by_id) ?? 'Someone')
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
              {supply && !stopped && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  supply.isEmpty
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : supply.isLow
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {formatSupplyLabel(supply)}
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
            {supply && !stopped && supply.isLow && (
              <p className="text-xs mt-1 font-medium text-amber-600 dark:text-amber-400">
                {supply.isEmpty ? 'Supply used up — start a new supply' : 'Running low — time to reorder'}
              </p>
            )}
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
            {supply && (
              <p className="px-4 pt-3 text-xs text-muted-foreground">
                Current supply started{' '}
                <span className="font-medium text-foreground">
                  {new Date(supply.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {' '}with {supply.quantity} {supply.unit}
                {supply.daysLeft !== null && !supply.isEmpty && (
                  <> · runs out ~{new Date(Date.now() + supply.daysLeft * 86_400_000).toLocaleDateString([], { month: 'short', day: 'numeric' })}</>
                )}
              </p>
            )}
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

                  if (row.type === 'refill') {
                    const event = row.event
                    const rd = event.details as Record<string, unknown>
                    // Sitters may only edit entries they logged (CareEventPolicy)
                    const canEdit = !isSitter || event.logged_by_id === currentUserId
                    return (
                      <div key={`refill-${event.id}`}>
                        {showDay && (
                          <p className="text-xs text-muted-foreground/60 font-medium mb-1 mt-2 first:mt-0">{day}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs">
                          <PackageOpen className="size-3 text-sky-500 shrink-0" aria-hidden="true" />
                          <span className="text-foreground font-medium">
                            New supply · {String(rd.supply_quantity)} {(rd.supply_unit as string) ?? supply?.unit ?? ''}
                          </span>
                          <span className="text-muted-foreground">· {formatTime(event.occurred_at)} · {memberLabel(event)}</span>
                          {event.notes && (
                            <span className="text-muted-foreground truncate">· {event.notes}</span>
                          )}
                          {canEdit && supply && (
                            <button
                              onClick={() => setEditingRefill(event)}
                              className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                              aria-label="Edit new supply entry"
                            >
                              <Pencil className="size-3" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  }

                  const event = row.event
                  const who = memberLabel(event)

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
                  {supply && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <button
                        onClick={() => setShowNewSupply(true)}
                        className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline"
                      >
                        New supply
                      </button>
                    </>
                  )}
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
          supply={supply}
          onClose={() => setShowLog(false)}
        />
      )}

      {(showNewSupply || editingRefill) && supply && (
        <NewSupplySheet
          catId={catId}
          householdId={householdId}
          startEvent={startEvent}
          supply={supply}
          editEvent={editingRefill ?? undefined}
          onClose={() => { setShowNewSupply(false); setEditingRefill(null) }}
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
