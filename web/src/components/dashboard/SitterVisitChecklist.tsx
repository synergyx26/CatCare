import { UtensilsCrossed, Droplets, Trash2 } from 'lucide-react'
import { getCatTodayStatus, type VacationContext, type CatCareRequirements } from '@/lib/helpers'
import type { Cat, CareEvent, EventType } from '@/types/api'

interface SitterVisitChecklistProps {
  cats: Cat[]
  householdId: number
  windowEvents: CareEvent[]
  vacationCtx: VacationContext
  memberMap: Map<number, string>
  currentUserId: number
  onLog: (cat: Cat, type?: EventType) => void
  requirements: Map<number, CatCareRequirements>
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
  vacationCtx,
  memberMap,
  currentUserId,
  onLog,
  requirements,
}: SitterVisitChecklistProps) {
  const rows = cats.map((cat) => {
    const reqs = requirements.get(cat.id)
    const status = getCatTodayStatus(cat.id, windowEvents, memberMap, currentUserId, reqs)

    const needed: string[] = []
    if (status.feedCount < status.feedingsNeeded) needed.push('feeding')
    if (status.trackWater && !status.waterDoneAt) needed.push('water')
    if (status.trackLitter && !status.litterDoneAt) needed.push('litter')

    // Most recent event for this cat in the window
    const lastEvent = windowEvents
      .filter((e) => e.cat_id === cat.id)
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())[0]

    return { cat, needed, lastEvent, allGood: needed.length === 0 }
  })

  const allGood = rows.every((r) => r.allGood)

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
          {rows.map(({ cat, needed, lastEvent, allGood: catGood }) => (
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
                    Needs: {needed.join(', ')}
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
                  {needed.includes('water') && (
                    <button
                      onClick={() => onLog(cat, 'water')}
                      className="flex size-7 items-center justify-center rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 transition-colors"
                      title="Log water"
                    >
                      <Droplets className="size-3.5" />
                    </button>
                  )}
                  {needed.includes('litter') && (
                    <button
                      onClick={() => onLog(cat, 'litter')}
                      className="flex size-7 items-center justify-center rounded-lg bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 transition-colors"
                      title="Log litter"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
