import { UtensilsCrossed, Pill } from 'lucide-react'
import { getCatTodayStatus, getActiveMedicationTasks, type VacationContext, type CatCareRequirements } from '@/lib/helpers'
import type { Cat, CareEvent, EventType, HouseholdChore, HouseholdChoreDefinition } from '@/types/api'

interface SitterVisitChecklistProps {
  cats: Cat[]
  householdId: number
  windowEvents: CareEvent[]
  allMedEvents: CareEvent[]
  vacationCtx: VacationContext
  memberMap: Map<number, string>
  currentUserId: number
  onLog: (cat: Cat, type?: EventType, opts?: { medicationName?: string }) => void
  requirements: Map<number, CatCareRequirements>
  // Household-level chores
  householdChores: HouseholdChore[]
  choreDefinitions: HouseholdChoreDefinition[]
  onLogChore: (definitionId: number) => void
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

export function SitterVisitChecklist({
  cats,
  windowEvents,
  allMedEvents,
  vacationCtx,
  memberMap,
  currentUserId,
  onLog,
  requirements,
  householdChores,
  choreDefinitions,
  onLogChore,
}: SitterVisitChecklistProps) {
  const rows = cats.map((cat) => {
    const reqs = requirements.get(cat.id)
    const status = getCatTodayStatus(cat.id, windowEvents, memberMap, currentUserId, reqs, allMedEvents)

    const needed: string[] = []
    if (status.feedCount < status.feedingsNeeded) needed.push('feeding')

    const dueMeds = getActiveMedicationTasks(cat.id, allMedEvents)
      .filter(t => t.dosesNeededToday > t.dosesGivenToday)

    const lastEvent = windowEvents
      .filter((e) => e.cat_id === cat.id)
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())[0]

    return { cat, needed, dueMeds, lastEvent, allGood: needed.length === 0 && dueMeds.length === 0 }
  })

  // Household chore status — today only
  const today = new Date()
  const todayChores = householdChores.filter(c => {
    const d = new Date(c.occurred_at)
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth()    === today.getMonth() &&
      d.getDate()     === today.getDate()
    )
  })
  const activeDefinitions = choreDefinitions.filter(d => d.active)
  const pendingChores = activeDefinitions.filter((def) => {
    const done = todayChores.filter(c => c.chore_definition_id === def.id).length
    return done < def.frequency_per_day
  })
  const choresDone = pendingChores.length === 0

  const allGood = rows.every((r) => r.allGood) && choresDone

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Visit Checklist</p>
          <p className="text-xs text-muted-foreground">
            What needs doing in the last {vacationCtx.windowDays} day{vacationCtx.windowDays !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {allGood ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/30 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3">
          <span className="text-lg">✓</span>
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
            All cats are taken care of!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Household chores row */}
          {activeDefinitions.length > 0 && (
            <div
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                choresDone
                  ? 'border-emerald-200 dark:border-emerald-800/20 bg-emerald-50/50 dark:bg-emerald-950/10'
                  : 'border-sky-200 dark:border-sky-800/20 bg-sky-50/50 dark:bg-sky-950/10'
              }`}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-100 to-violet-100 dark:from-sky-900/30 dark:to-violet-900/30 text-base">
                🏠
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-none">Household</p>
                {choresDone ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">All done</p>
                ) : (
                  <p className="text-xs text-sky-700 dark:text-sky-400 mt-0.5">
                    Needs: {pendingChores.map(d => {
                      const done = todayChores.filter(c => c.chore_definition_id === d.id).length
                      return d.frequency_per_day > 1 ? `${d.name} (${done}/${d.frequency_per_day})` : d.name
                    }).join(', ')}
                  </p>
                )}
              </div>

              {!choresDone && (
                <div className="flex flex-wrap items-center gap-1.5 shrink-0 max-w-[120px]">
                  {pendingChores.map(def => (
                    <button
                      key={def.id}
                      onClick={() => onLogChore(def.id)}
                      className="flex items-center gap-1 h-7 px-2 rounded-lg bg-sky-100 hover:bg-sky-200 dark:bg-sky-900/40 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-xs transition-colors"
                      title={`Log ${def.name}`}
                    >
                      {def.emoji && <span>{def.emoji}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Per-cat rows */}
          {rows.map(({ cat, needed, dueMeds, lastEvent, allGood: catGood }) => (
            <div
              key={cat.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                catGood
                  ? 'border-emerald-200 dark:border-emerald-800/20 bg-emerald-50/50 dark:bg-emerald-950/10'
                  : 'border-amber-200 dark:border-amber-800/20 bg-amber-50/50 dark:bg-amber-950/10'
              }`}
            >
              {/* Cat avatar */}
              {cat.photo_url ? (
                <img
                  src={cat.photo_url}
                  alt={cat.name}
                  className="size-9 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 text-sm font-bold text-slate-600 dark:text-slate-300">
                  {cat.name.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Name + status */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-none truncate">
                  {cat.name}
                </p>
                {catGood ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                    All done
                    {lastEvent ? ` · ${formatTimeAgo(lastEvent.occurred_at)}` : ''}
                  </p>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Needs: {[
                      ...needed,
                      ...dueMeds.map(m =>
                        m.dosesNeededToday > 1
                          ? `${m.name} (${m.dosesGivenToday}/${m.dosesNeededToday})`
                          : m.name
                      ),
                    ].join(', ')}
                    {lastEvent ? ` · last ${formatTimeAgo(lastEvent.occurred_at)}` : ' · no recent care'}
                  </p>
                )}
              </div>

              {/* Quick-log buttons (only shown when something is needed) */}
              {!catGood && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {needed.includes('feeding') && (
                    <button
                      onClick={() => onLog(cat, 'feeding')}
                      className="flex size-7 items-center justify-center rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 transition-colors"
                      title="Log feeding"
                    >
                      <UtensilsCrossed className="size-3.5" />
                    </button>
                  )}
                  {dueMeds.map(med => (
                    <button
                      key={med.name}
                      onClick={() => onLog(cat, 'medication', { medicationName: med.name })}
                      className="flex size-7 items-center justify-center rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 transition-colors"
                      title={`Log ${med.name}`}
                    >
                      <Pill className="size-3.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
