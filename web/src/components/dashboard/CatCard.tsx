import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CatStatusBadges } from './CatStatusBadges'
import { getCatTodayStatus, type CatTodayStatus } from '@/lib/helpers'
import { UtensilsCrossed, Droplets, Trash2, Plus } from 'lucide-react'
import type { Cat, CareEvent, EventType } from '@/types/api'

interface CatCardProps {
  cat: Cat
  householdId: number
  todayEvents: CareEvent[]
  memberMap: Map<number, string>
  currentUserId: number
  onLog: (cat: Cat, type?: EventType) => void
}

function getStatusLine(status: CatTodayStatus): { text: string; allGood: boolean } {
  const issues: string[] = []
  if (status.feedCount < status.feedingsNeeded) issues.push('feeding')
  if (status.trackWater && !status.waterDoneAt) issues.push('water')
  if (status.trackLitter && !status.litterDoneAt) issues.push('litter')

  if (issues.length === 0) return { text: 'All caught up', allGood: true }
  if (issues.length === 1) return { text: `Needs ${issues[0]}`, allGood: false }
  return { text: 'Needs attention', allGood: false }
}

export function CatCard({
  cat,
  householdId,
  todayEvents,
  memberMap,
  currentUserId,
  onLog,
}: CatCardProps) {
  const navigate = useNavigate()
  const status: CatTodayStatus = getCatTodayStatus(
    cat.id,
    todayEvents,
    memberMap,
    currentUserId,
    {
      feedings_per_day:    cat.feedings_per_day,
      track_water:         cat.track_water,
      track_litter:        cat.track_litter,
      track_toothbrushing: cat.track_toothbrushing,
    }
  )
  const { text: statusText, allGood } = getStatusLine(status)

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
      <div className="p-4 space-y-3">
        {/* Top row: avatar + name + status line + chips */}
        <button
          onClick={() => navigate(`/households/${householdId}/cats/${cat.id}`)}
          className="flex w-full items-center gap-3 text-left"
        >
          {cat.photo_url ? (
            <img
              src={cat.photo_url}
              alt={cat.name}
              className="size-10 shrink-0 rounded-xl border border-border/40 object-cover"
            />
          ) : (
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-bold ${
                allGood
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
              }`}
            >
              {cat.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-none">{cat.name}</p>
            <p
              className={`text-xs font-medium mt-0.5 ${
                allGood
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {statusText}
            </p>
            <CatStatusBadges status={status} />
          </div>
        </button>

        {/* Quick-action row */}
        <div className="flex gap-2 border-t border-border/40 pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 active:scale-95 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
            onClick={() => onLog(cat, 'feeding')}
          >
            <UtensilsCrossed className="size-3.5" />
            Feed
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 active:scale-95 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/30"
            onClick={() => onLog(cat, 'litter')}
          >
            <Trash2 className="size-3.5" />
            Litter
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 active:scale-95 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
            onClick={() => onLog(cat, 'water')}
          >
            <Droplets className="size-3.5" />
            Water
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 active:scale-95 rounded-xl"
            onClick={() => onLog(cat)}
          >
            <Plus className="size-3.5" />
            More
          </Button>
        </div>
      </div>
    </div>
  )
}
