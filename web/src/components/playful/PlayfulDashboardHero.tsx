import type { ReactNode } from 'react'
import type { Cat } from '@/types/api'
import { AnimatedCat, WalkingCat, coatForCat } from './AnimatedCat'

// Playful-preview replacement for the dashboard's greeting header. Pure
// presentation: DashboardPage computes the counts and passes the Add Cat
// button in as `action`, so tier gating stays in one place.

interface PlayfulDashboardHeroProps {
  greeting: string
  /** Sum of every cat's task units (feedings, doses, teeth) for the window. */
  doneTasks: number
  totalTasks: number
  catNamesNeedingCare: string[]
  catCount: number
  /** Set during vacation mode — status is over the last N days, not today. */
  vacationWindowDays?: number
  /** A real cat, so the lounging cat matches one of the cards. */
  loungingCat?: Cat
  action?: ReactNode
}

const RING_CIRCUMFERENCE = 2 * Math.PI * 50

export function PlayfulDashboardHero({
  greeting,
  doneTasks,
  totalTasks,
  catNamesNeedingCare,
  catCount,
  vacationWindowDays,
  loungingCat,
  action,
}: PlayfulDashboardHeroProps) {
  const allDone = catCount > 0 && catNamesNeedingCare.length === 0
  const progress = totalTasks > 0 ? doneTasks / totalTasks : allDone ? 1 : 0
  const today = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  let message: string
  if (catCount === 0) {
    message = "Let's add your first cat."
  } else if (allDone) {
    message = vacationWindowDays
      ? `Everyone's been cared for in the last ${vacationWindowDays}d. 😴`
      : "Everyone's fed and happy. Time for a nap. 😴"
  } else {
    const names = catNamesNeedingCare.length > 2
      ? `${catNamesNeedingCare.slice(0, -1).join(', ')} and ${catNamesNeedingCare[catNamesNeedingCare.length - 1]}`
      : catNamesNeedingCare.join(' and ')
    message = `${names} could use a little love${vacationWindowDays ? ` (last ${vacationWindowDays}d)` : ' today'}.`
  }

  return (
    <section className="pl-hero pl-rise relative mb-6 overflow-hidden rounded-[28px] px-5 pb-20 pt-5 sm:px-7 sm:pt-6">
      <div className="relative z-[2] flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider opacity-70">{today}</p>
          <h1 className="mt-1 font-display text-2xl leading-tight sm:text-3xl">{greeting}</h1>
          <p className="mt-1.5 max-w-[46ch] text-sm opacity-85 sm:text-base">{message}</p>
          {action && <div className="pl-hero-action mt-4 flex flex-wrap gap-2">{action}</div>}
        </div>

        {totalTasks > 0 && (
          <div className="relative size-20 shrink-0 sm:size-28" role="img" aria-label={`${doneTasks} of ${totalTasks} care tasks done`}>
            <svg viewBox="0 0 120 120" className="size-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" strokeWidth="12" className="stroke-white/45" />
              <circle
                cx="60" cy="60" r="50" fill="none" strokeWidth="12" strokeLinecap="round"
                className="pl-ring stroke-white"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <span className="block font-display text-xl leading-none sm:text-3xl">{doneTasks}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-80 sm:text-[11px]">of {totalTasks} done</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ground strip with the walking cat, rolling yarn and a lounging cat */}
      <div className="pl-ground absolute inset-x-0 bottom-0 h-6" />
      <WalkingCat className="pl-walker absolute bottom-4 w-[88px]" />
      <svg className="pl-yarn absolute bottom-3.5 size-7" viewBox="0 0 30 30" aria-hidden="true">
        <circle cx="15" cy="15" r="13" fill="#ec4899" />
        <path d="M5 10 q10 6 20 0 M4 16 q11 7 22 0 M8 22 q7 4 14 0 M12 3 q-4 12 3 24" stroke="#fff" strokeOpacity=".55" strokeWidth="1.6" fill="none" />
      </svg>
      <div className="absolute bottom-4 right-4 z-[1] w-20 sm:right-7 sm:w-24">
        {allDone && (
          <div className="pl-zzz" aria-hidden="true"><span>z</span><span>z</span><span>Z</span></div>
        )}
        <AnimatedCat coat={coatForCat(loungingCat ?? { id: 1 })} mood={allDone ? 'sleep' : 'happy'} className="w-full" />
      </div>
    </section>
  )
}
