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
    currentUserId
  )

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-md shadow-sky-500/5 hover:shadow-lg hover:shadow-sky-500/10 transition-all hover:-translate-y-0.5 overflow-hidden">
      {/* Colored top accent */}
      <div className="h-1 bg-gradient-to-r from-sky-400 to-cyan-400" />

      <div className="p-4 space-y-3">
        {/* Top row: avatar + name + profile link */}
        <button
          onClick={() => navigate(`/households/${householdId}/cats/${cat.id}`)}
          className="flex w-full items-center gap-3 text-left"
        >
          {cat.photo_url ? (
            <img
              src={cat.photo_url}
              alt={cat.name}
              className="size-14 shrink-0 rounded-2xl border-2 border-sky-100 dark:border-sky-900/40 object-cover"
            />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-100 dark:from-sky-900/30 dark:to-cyan-900/30 text-sky-600 dark:text-sky-400">
              <span className="text-lg font-bold">
                {cat.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-base">{cat.name}</p>
            {cat.breed && (
              <p className="truncate text-xs text-muted-foreground">
                {cat.breed}
              </p>
            )}
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
