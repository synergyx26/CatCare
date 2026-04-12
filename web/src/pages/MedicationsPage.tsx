import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Lock, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { MedicationCard } from '@/components/medications/MedicationCard'
import { AddMedicationModal } from '@/components/medications/AddMedicationModal'
import type { Cat, CareEvent, Household } from '@/types/api'

export function MedicationsPage() {
  const { householdId, catId } = useParams<{ householdId: string; catId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const tier    = user?.subscription_tier ?? 'free'
  const canAccess = tier !== 'free'

  const [showAddModal, setShowAddModal] = useState(false)
  const [stoppedExpanded, setStoppedExpanded] = useState(false)

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: catData, isLoading: catLoading } = useQuery({
    queryKey: ['cat', householdId, catId],
    queryFn: () => api.getCat(Number(householdId), Number(catId)),
  })

  const { data: householdData } = useQuery({
    queryKey: ['household', householdId],
    queryFn: () => api.getHousehold(Number(householdId)),
  })

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['care_events', householdId, Number(catId), 'medication'],
    queryFn: () =>
      api.getCareEvents(Number(householdId), {
        catId:      Number(catId),
        eventTypes: ['medication'],
      }),
    staleTime: 60_000,
    enabled:   !!householdId && !!catId && canAccess,
  })

  const cat: Cat | undefined       = catData?.data?.data
  const household: Household | undefined = householdData?.data?.data

  usePageTitle(cat ? `${cat.name} · Medications` : 'Medications')

  const currentRole  = household?.members.find((m) => m.id === user?.id)?.role ?? null
  const isSitter     = currentRole === 'sitter'

  // Member lookup map
  const memberMap = new Map<number, string>(
    (household?.members ?? []).map((m) => [m.id, m.name])
  )

  // ── Group events ──────────────────────────────────────────────────────────

  const allMedEvents: CareEvent[] = (eventsData?.data?.data ?? []).sort(
    (a: CareEvent, b: CareEvent) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  )

  interface Regimen {
    name: string
    startEvent: CareEvent
    doseHistory: CareEvent[]
    stopped: boolean
  }

  // Build regimen map: newest start event per medication name
  const regimenMap = new Map<string, Regimen>()
  const dosesByName = new Map<string, CareEvent[]>()

  for (const event of allMedEvents) {
    const d = event.details as Record<string, unknown>
    const medName = (d.medication_name as string) || 'Unknown medication'

    if (d.active_medication === true) {
      // Start event — only keep the most recent one per name
      if (!regimenMap.has(medName)) {
        regimenMap.set(medName, {
          name:       medName,
          startEvent: event,
          doseHistory: [],
          stopped:    d.stopped === true,
        })
      }
    } else {
      // Dose log — collect for the matching regimen
      const existing = dosesByName.get(medName) ?? []
      existing.push(event)
      dosesByName.set(medName, existing)
    }
  }

  // Attach dose history to each regimen — only doses on/after the start event
  // (pre-start manual logs are historical context, not adherence data for this regimen)
  for (const [name, regimen] of regimenMap) {
    const startMs = new Date(regimen.startEvent.occurred_at).getTime()
    regimen.doseHistory = (dosesByName.get(name) ?? []).filter(
      d => new Date(d.occurred_at).getTime() >= startMs
    )
  }

  const active  = Array.from(regimenMap.values()).filter((r) => !r.stopped)
  const stopped = Array.from(regimenMap.values()).filter((r) =>  r.stopped)

  // ── Loading ───────────────────────────────────────────────────────────────

  if (catLoading) return <PageSkeleton />

  // ── Tier gate ─────────────────────────────────────────────────────────────

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <PageHeader
          title="Medications"
          subtitle={cat ? `${cat.name}'s medications` : 'Medication tracking'}
          backTo={{ label: cat ? cat.name : 'Back', onClick: () => navigate(-1) }}
        />
        <div className="mt-10 flex flex-col items-center gap-4 text-center py-16 border border-dashed border-border rounded-2xl bg-muted/20">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Lock className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">
              Medication tracking requires Pro or Premium
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Upgrade to track medications, log doses, monitor adherence, and see full dose history for each cat.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <PageHeader
        title="Medications"
        subtitle={cat ? `${cat.name}'s medications` : 'Medication tracking'}
        backTo={{ label: cat ? cat.name : 'Back', onClick: () => navigate(-1) }}
        action={
          !isSitter ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
            >
              <Plus className="size-4" />
              Add medication
            </button>
          ) : undefined
        }
      />

      {eventsLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Active medications */}
          {active.length === 0 && stopped.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border/60 rounded-2xl bg-muted/10">
              <p className="text-sm text-muted-foreground">No medications yet.</p>
              {!isSitter && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-2 text-sm text-red-500 font-medium hover:underline"
                >
                  Start the first medication
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {active.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Active
                  </p>
                  {active.map((regimen) => (
                    <MedicationCard
                      key={regimen.name}
                      householdId={Number(householdId)}
                      catId={Number(catId)}
                      name={regimen.name}
                      startEvent={regimen.startEvent}
                      doseHistory={regimen.doseHistory}
                      memberMap={memberMap}
                      currentUserId={user?.id ?? 0}
                      isSitter={isSitter}
                      defaultExpanded={active.length === 1}
                    />
                  ))}
                </>
              )}

              {/* Stopped section */}
              {stopped.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => setStoppedExpanded((x) => !x)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors mb-3"
                  >
                    {stoppedExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    Stopped / Completed ({stopped.length})
                  </button>
                  {stoppedExpanded && (
                    <div className="space-y-3">
                      {stopped.map((regimen) => (
                        <MedicationCard
                          key={regimen.name}
                          householdId={Number(householdId)}
                          catId={Number(catId)}
                          name={regimen.name}
                          startEvent={regimen.startEvent}
                          doseHistory={regimen.doseHistory}
                          memberMap={memberMap}
                          currentUserId={user?.id ?? 0}
                          isSitter={isSitter}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showAddModal && cat && (
        <AddMedicationModal
          catId={cat.id}
          householdId={Number(householdId)}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
