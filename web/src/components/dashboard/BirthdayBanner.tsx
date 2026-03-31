import { useState } from 'react'
import { Cake, Heart, X, Sparkles } from 'lucide-react'
import { isCatBirthday, getCatAge } from '@/lib/helpers'
import type { Cat, EventType } from '@/types/api'

interface BirthdayBannerProps {
  cats: Cat[]
  onLog: (cat: Cat, type?: EventType) => void
}

export function BirthdayBanner({ cats, onLog }: BirthdayBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  const birthdayCats = cats.filter(
    (c) => c.active && !c.deceased && isCatBirthday(c.birthday),
  )

  if (dismissed || birthdayCats.length === 0) return null

  const title =
    birthdayCats.length === 1
      ? `Happy birthday, ${birthdayCats[0].name}!`
      : `Happy birthday to ${birthdayCats.length} special cats!`

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-200 dark:border-rose-800/30 bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50/80 dark:from-rose-950/25 dark:via-pink-950/20 dark:to-amber-950/10 p-4 shadow-sm">
      {/* Decorative background accents */}
      <span
        aria-hidden="true"
        className="pointer-events-none select-none absolute -right-2 -top-3 text-6xl opacity-[0.07]"
      >
        🎂
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none select-none absolute right-14 bottom-0 text-4xl opacity-[0.07] rotate-12"
      >
        🎉
      </span>

      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
        aria-label="Dismiss birthday banner"
      >
        <X className="size-3.5" />
      </button>

      <div className="space-y-3 pr-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/40">
            <Cake className="size-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300 leading-tight">
              {title}
            </p>
            <p className="text-xs text-rose-500 dark:text-rose-400/80">
              Show them some love today
            </p>
          </div>
        </div>

        {/* Per-cat rows */}
        <div className="space-y-2">
          {birthdayCats.map((cat) => {
            const age = getCatAge(cat.birthday)
            const ageLabel =
              age === null
                ? null
                : age === 0
                  ? 'first birthday!'
                  : `turning ${age} today`

            return (
              <div
                key={cat.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/50 dark:bg-white/5 border border-rose-100 dark:border-rose-800/20 px-3 py-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {cat.photo_url ? (
                    <img
                      src={cat.photo_url}
                      alt={cat.name}
                      className="size-8 shrink-0 rounded-lg object-cover ring-2 ring-rose-300 dark:ring-rose-600"
                    />
                  ) : (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-200 to-pink-200 dark:from-rose-800/50 dark:to-pink-800/50 ring-2 ring-rose-300 dark:ring-rose-600 text-xs font-bold text-rose-700 dark:text-rose-300">
                      {cat.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-none truncate">
                      {cat.name}
                    </p>
                    {ageLabel && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                        {ageLabel}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onLog(cat, 'note')}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500 hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500 text-white transition-colors active:scale-95"
                >
                  <Heart className="size-3" />
                  Send love
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer sparkle hint */}
        <div className="flex items-center gap-1 pt-0.5">
          <Sparkles className="size-3 text-rose-400 dark:text-rose-500 shrink-0" />
          <p className="text-xs text-rose-400 dark:text-rose-500">
            Log a note to celebrate this special day
          </p>
        </div>
      </div>
    </div>
  )
}
