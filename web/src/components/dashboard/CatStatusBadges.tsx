import { formatTime, type CatTodayStatus } from '@/lib/helpers'

export function CatStatusBadges({ status }: { status: CatTodayStatus }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {/* Feeding */}
      {status.feedCount > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {status.feedCount}x fed · {formatTime(status.lastFedAt!)} by{' '}
          {status.lastFedBy}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Not fed today
        </span>
      )}

      {/* Litter */}
      {status.litterDoneAt ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
          Litter {formatTime(status.litterDoneAt)}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Litter pending
        </span>
      )}

      {/* Water */}
      {status.waterDoneAt ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          Water {formatTime(status.waterDoneAt)}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Water pending
        </span>
      )}
    </div>
  )
}
