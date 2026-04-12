import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { CatStatusBadges } from './CatStatusBadges'
import { getCatTodayStatus, isCatBirthday, getCatAge, type CatTodayStatus } from '@/lib/helpers'
import { UtensilsCrossed, Droplets, Trash2, Plus } from 'lucide-react'
import type { Cat, CareEvent, EventType } from '@/types/api'

interface CatCardProps {
  cat: Cat
  householdId: number
  todayEvents: CareEvent[]
  allMedEvents?: CareEvent[]
  memberMap: Map<number, string>
  currentUserId: number
  onLog: (cat: Cat, type?: EventType, opts?: { medicationName?: string }) => void
  vacationMode?: boolean
}

function getStatusLine(status: CatTodayStatus): { text: string; allGood: boolean } {
  const issues: string[] = []
  if (status.feedCount < status.feedingsNeeded) issues.push('feeding')
  if (status.trackWater && !status.waterDoneAt) issues.push('water')
  if (status.trackLitter && !status.litterDoneAt) issues.push('litter')
  const dueMeds = status.medicationTasks.filter(t => t.dosesNeededToday > t.dosesGivenToday)
  if (dueMeds.length > 0) issues.push('medication')

  if (issues.length === 0) return { text: 'All caught up', allGood: true }
  if (issues.length === 1) return { text: `Needs ${issues[0]}`, allGood: false }
  return { text: 'Needs attention', allGood: false }
}

export function CatCard({
  cat,
  householdId,
  todayEvents,
  allMedEvents,
  memberMap,
  currentUserId,
  onLog,
  vacationMode = false,
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
    },
    allMedEvents,
  )
  const { text: statusText, allGood } = getStatusLine(status)
  const isBirthday = isCatBirthday(cat.birthday)
  const catAge = getCatAge(cat.birthday)
  const birthdayStatusText =
    catAge === 0
      ? 'First birthday!'
      : catAge !== null
        ? `Turning ${catAge} today`
        : 'Happy Birthday!'

  return (
    <div
      className={`rounded-2xl bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden ${
        isBirthday
          ? 'ring-2 ring-rose-300 dark:ring-rose-700/60'
          : 'ring-1 ring-border/60'
      }`}
    >
      {isBirthday && (
        <div className="bg-gradient-to-r from-rose-50 via-pink-50 to-amber-50/70 dark:from-rose-950/20 dark:via-pink-950/20 dark:to-amber-950/10 px-4 py-1.5 flex items-center gap-1.5 border-b border-rose-100 dark:border-rose-800/20">
          <span aria-hidden="true" className="text-sm leading-none">🎂</span>
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
            {catAge === 0 ? 'First birthday!' : catAge !== null ? `${catAge} years old today` : 'Birthday today!'}
          </span>
        </div>
      )}
      <div className="p-4 space-y-3">
        {/* Top row: avatar + name + status line + chips */}
        <button
          onClick={() => navigate(`/households/${householdId}/cats/${cat.id}`)}
          aria-label={`View ${cat.name}'s profile`}
          className="flex w-full items-center gap-3 text-left"
        >
          <div className="relative shrink-0 size-10">
            {cat.photo_url ? (
              <img
                src={cat.photo_url}
                alt={cat.name}
                className={`size-10 rounded-xl border object-cover ${
                  isBirthday
                    ? 'border-rose-300 dark:border-rose-700/60 ring-2 ring-rose-400/70 ring-offset-1 dark:ring-rose-600/60'
                    : 'border-border/40'
                }`}
              />
            ) : (
              <div
                className={`flex size-10 items-center justify-center rounded-xl text-base font-bold ${
                  isBirthday
                    ? 'bg-gradient-to-br from-rose-100 to-pink-100 text-rose-700 dark:from-rose-900/35 dark:to-pink-900/35 dark:text-rose-400 ring-2 ring-rose-400/70 ring-offset-1 dark:ring-rose-600/60'
                    : allGood
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
                }`}
              >
                {cat.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-none">{cat.name}</p>
            <p
              className={`text-xs font-medium mt-0.5 ${
                isBirthday
                  ? 'text-rose-600 dark:text-rose-400'
                  : allGood
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {isBirthday
                ? birthdayStatusText
                : vacationMode && allGood
                  ? 'All caught up (recent)'
                  : statusText}
            </p>
            <CatStatusBadges status={status} />
          </div>
        </button>

        {/* Quick-action row */}
        <div className="flex gap-2 border-t border-border/40 pt-3" role="group" aria-label={`Quick actions for ${cat.name}`}>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Log feeding for ${cat.name}`}
            className="flex-1 active:scale-95 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
            onClick={() => onLog(cat, 'feeding')}
          >
            <UtensilsCrossed className="size-3.5" aria-hidden="true" />
            Feed
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Log litter for ${cat.name}`}
            className="flex-1 active:scale-95 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/30"
            onClick={() => onLog(cat, 'litter')}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Litter
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Log water for ${cat.name}`}
            className="flex-1 active:scale-95 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
            onClick={() => onLog(cat, 'water')}
          >
            <Droplets className="size-3.5" aria-hidden="true" />
            Water
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Log more care for ${cat.name}`}
            className="flex-1 active:scale-95 rounded-xl"
            onClick={() => onLog(cat)}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            More
          </Button>
        </div>
      </div>
    </div>
  )
}
