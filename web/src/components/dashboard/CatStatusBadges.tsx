import type { CatTodayStatus } from '@/lib/helpers'

interface ChipProps {
  emoji: string
  label: string
  done: boolean
  doneClass: string
}

function StatusChip({ emoji, label, done, doneClass }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
        done ? doneClass : 'bg-muted text-muted-foreground/50'
      }`}
    >
      {emoji} {label}
    </span>
  )
}

export function CatStatusBadges({ status }: { status: CatTodayStatus }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <StatusChip
        emoji="🍽️"
        label={status.feedingsNeeded > 1
          ? `${status.feedCount}/${status.feedingsNeeded} fed`
          : 'Fed'}
        done={status.feedCount >= status.feedingsNeeded}
        doneClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      />
      {status.trackWater && (
        <StatusChip
          emoji="💧"
          label="Water"
          done={!!status.waterDoneAt}
          doneClass="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
        />
      )}
      {status.trackLitter && (
        <StatusChip
          emoji="🧹"
          label="Litter"
          done={!!status.litterDoneAt}
          doneClass="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
        />
      )}
      {status.trackToothbrushing && (
        <StatusChip
          emoji="🦷"
          label="Teeth"
          done={!!status.toothbrushingDoneAt}
          doneClass="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
        />
      )}
      {status.recentSymptomAt && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
          🤒 Symptom logged
        </span>
      )}
    </div>
  )
}
