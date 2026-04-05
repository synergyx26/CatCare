import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notify } from '@/lib/notify'
import { Lock, Pencil, Plus } from 'lucide-react'
import type { AxiosError } from 'axios'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { formatTime } from '@/lib/helpers'
import type { ApiError, CareEvent, MemberRole } from '@/types/api'

interface Props {
  householdId: number
  catId: number
  currentRole: MemberRole | null
  onOpenModal: (opts: { prefillName?: string; initialEvent?: CareEvent }) => void
}

export function MedicationsSection({ householdId, catId, currentRole, onOpenModal }: Props) {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const tier = user?.subscription_tier ?? 'free'
  const canLog = tier !== 'free'
  const isSitter = currentRole === 'sitter'

  const { data } = useQuery({
    queryKey: ['care_events', householdId, catId, 'medication'],
    queryFn: () =>
      api.getCareEvents(householdId, { catId, eventTypes: ['medication'] }),
    staleTime: 60_000,
    enabled: !!householdId && !!catId,
  })

  const medicationEvents: CareEvent[] = (data?.data?.data ?? []).sort(
    (a: CareEvent, b: CareEvent) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  )

  // Group by medication name — keep only the most recent entry per name.
  // Skip historical imports (historical: true); those appear only in the care log.
  const medicationMap = new Map<
    string,
    { lastAt: string; dosage: string; unit: string; event: CareEvent; stopped: boolean }
  >()
  for (const event of medicationEvents) {
    const d = event.details as Record<string, unknown>
    if (d.historical === true) continue
    const name = (d.medication_name as string) || 'Unknown medication'
    if (!medicationMap.has(name)) {
      medicationMap.set(name, {
        lastAt:  event.occurred_at,
        dosage:  (d.dosage as string) ?? '',
        unit:    (d.unit   as string) ?? '',
        event,
        stopped: d.stopped === true,
      })
    }
  }

  const active  = Array.from(medicationMap.entries()).filter(([, v]) => !v.stopped)
  const stopped = Array.from(medicationMap.entries()).filter(([, v]) =>  v.stopped)

  const stopMutation = useMutation({
    mutationFn: ({ event }: { event: CareEvent }) => {
      const existing = event.details as Record<string, unknown>
      return api.updateCareEvent(householdId, event.id, {
        care_event: { details: { ...existing, stopped: true } },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care_events', householdId, catId, 'medication'] })
      notify.success('Medication stopped')
    },
    onError: (err: AxiosError<ApiError>) => {
      const msg = err.response?.data?.message ?? 'Failed to stop medication'
      notify.error(msg)
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: ({ event }: { event: CareEvent }) => {
      const existing = event.details as Record<string, unknown>
      const { stopped: _removed, ...rest } = existing as Record<string, unknown> & { stopped?: boolean }
      return api.updateCareEvent(householdId, event.id, {
        care_event: { details: rest },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care_events', householdId, catId, 'medication'] })
      notify.success('Medication reactivated')
    },
    onError: (err: AxiosError<ApiError>) => {
      const msg = err.response?.data?.message ?? 'Failed to reactivate medication'
      notify.error(msg)
    },
  })

  function handleLogClick() {
    if (!canLog) {
      notify.tierLimit('Upgrade to Pro or Premium to log medications.')
      return
    }
    onOpenModal({})
  }

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm overflow-hidden">
      <div className="px-4 py-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
            Medications
          </p>
          {!isSitter && (
            <button
              onClick={handleLogClick}
              className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
            >
              {!canLog ? <Lock className="size-3" /> : <Plus className="size-3" />}
              Log medication
            </button>
          )}
        </div>

        {/* Active medications */}
        {active.length === 0 && stopped.length === 0 && (
          <p className="text-xs text-muted-foreground py-1">No medications logged yet.</p>
        )}

        {active.map(([name, { lastAt, dosage, unit, event }]) => (
          <div key={name} className="flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium truncate">{name}</p>
              {dosage && (
                <p className="text-xs text-muted-foreground">{dosage} {unit}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">Last: {formatTime(lastAt)}</span>
              {!isSitter && (
                <>
                  <button
                    onClick={() => {
                      if (!canLog) { notify.tierLimit('Upgrade to Pro or Premium to log medications.'); return }
                      onOpenModal({ prefillName: name })
                    }}
                    className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
                  >
                    Log dose
                  </button>
                  <button
                    onClick={() => stopMutation.mutate({ event })}
                    disabled={stopMutation.isPending}
                    className="text-xs text-muted-foreground hover:text-destructive hover:underline transition-colors disabled:opacity-40"
                  >
                    Stop
                  </button>
                  <button
                    onClick={() => onOpenModal({ initialEvent: event })}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Edit ${name}`}
                  >
                    <Pencil className="size-3" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {/* Stopped medications */}
        {stopped.length > 0 && (
          <div className="border-t border-border/40 pt-2 mt-1 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Stopped</p>
            {stopped.map(([name, { lastAt, dosage, unit, event }]) => (
              <div key={name} className="flex items-start justify-between gap-3 text-sm opacity-50">
                <div className="min-w-0">
                  <p className="font-medium truncate line-through">{name}</p>
                  {dosage && (
                    <p className="text-xs text-muted-foreground">{dosage} {unit}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">Last: {formatTime(lastAt)}</span>
                  {!isSitter && (
                    <button
                      onClick={() => reactivateMutation.mutate({ event })}
                      disabled={reactivateMutation.isPending}
                      className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium opacity-100 disabled:opacity-40"
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
