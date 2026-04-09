import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Lock, Plus } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { formatTime } from '@/lib/helpers'
import { notify } from '@/lib/notify'
import type { CareEvent, MemberRole } from '@/types/api'

interface Props {
  householdId: number
  catId: number
  currentRole: MemberRole | null
  onOpenModal: (opts: { prefillName?: string; initialEvent?: CareEvent }) => void
}

export function MedicationsSection({ householdId, catId, currentRole, onOpenModal }: Props) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const tier    = user?.subscription_tier ?? 'free'
  const canLog  = tier !== 'free'
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

  // Build summary: newest start event per medication name
  const summaryMap = new Map<string, { lastAt: string; dosage: string; unit: string; stopped: boolean }>()
  for (const event of medicationEvents) {
    const d = event.details as Record<string, unknown>
    if (d.active_medication !== true) continue
    const name = (d.medication_name as string) || 'Unknown medication'
    if (!summaryMap.has(name)) {
      summaryMap.set(name, {
        lastAt:  event.occurred_at,
        dosage:  (d.dosage as string) ?? '',
        unit:    (d.unit   as string) ?? '',
        stopped: d.stopped === true,
      })
    }
  }

  // Also account for dose events to find the actual last-given time
  const lastDoseMap = new Map<string, string>()
  for (const event of medicationEvents) {
    const d = event.details as Record<string, unknown>
    if (d.active_medication === true) continue
    const name = (d.medication_name as string) || 'Unknown medication'
    if (!lastDoseMap.has(name)) {
      lastDoseMap.set(name, event.occurred_at)
    }
  }

  const active  = Array.from(summaryMap.entries()).filter(([, v]) => !v.stopped)
  const stopped = Array.from(summaryMap.entries()).filter(([, v]) =>  v.stopped)

  function handleAddClick() {
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
          <button
            onClick={() => navigate(`/households/${householdId}/cats/${catId}/medications`)}
            className="flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider hover:underline"
          >
            Medications
            <ChevronRight className="size-3" />
          </button>
          {!isSitter && (
            <button
              onClick={handleAddClick}
              className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
            >
              {!canLog ? <Lock className="size-3" /> : <Plus className="size-3" />}
              Add
            </button>
          )}
        </div>

        {/* Summary rows — active medications only */}
        {active.length === 0 && stopped.length === 0 && (
          <p className="text-xs text-muted-foreground py-1">No medications logged yet.</p>
        )}

        {active.map(([name, { dosage, unit }]) => {
          const lastAt = lastDoseMap.get(name) ?? summaryMap.get(name)!.lastAt
          return (
            <div key={name} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate text-sm">{name}</p>
                {dosage && (
                  <p className="text-xs text-muted-foreground">{dosage} {unit}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                Last: {formatTime(lastAt)}
              </span>
            </div>
          )
        })}

        {/* Stopped summary — compact */}
        {stopped.length > 0 && (
          <p className="text-xs text-muted-foreground pt-1">
            +{stopped.length} stopped
          </p>
        )}

        {/* View all link when there are medications */}
        {(active.length > 0 || stopped.length > 0) && (
          <button
            onClick={() => navigate(`/households/${householdId}/cats/${catId}/medications`)}
            className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
          >
            View history & manage →
          </button>
        )}
      </div>
    </div>
  )
}
