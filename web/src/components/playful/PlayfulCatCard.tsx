import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import type { Cat, CareEvent, CareNote, EventType } from '@/types/api'
import type { CatCareRequirements } from '@/lib/helpers'
import { isCatBirthday, getCatAge } from '@/lib/helpers'
import { EVENT_COLORS } from '@/lib/eventColors'
import {
  summarizeCatTasks,
  getMedicationStartDetails,
  hasCatCareInfo,
  CatCareInfo,
} from '@/components/dashboard/catTaskSummary'
import { AnimatedCat, coatForCat, type CatMood } from './AnimatedCat'
import { floatEmoji, prefersReducedMotion } from './effects'

// Playful-preview counterpart of CatTaskCard — same props, same onLog calls,
// same pending/done rules (via summarizeCatTasks); only presentation differs.

interface PlayfulCatCardProps {
  cat: Cat
  index: number
  windowEvents: CareEvent[]
  allMedEvents: CareEvent[]
  memberMap: Map<number, string>
  currentUserId: number
  requirements: CatCareRequirements | undefined
  onLog: (cat: Cat, type?: EventType, opts?: { medicationName?: string; medicationDosage?: string; medicationUnit?: string }) => void
  careNotes?: CareNote[]
}

export function PlayfulCatCard({
  cat,
  index,
  windowEvents,
  allMedEvents,
  memberMap,
  currentUserId,
  requirements,
  onLog,
  careNotes = [],
}: PlayfulCatCardProps) {
  const navigate = useNavigate()
  const [careOpen, setCareOpen] = useState(false)
  // Bumping this remounts the cat wrapper, which replays the pl-jump animation.
  const [jumpKey, setJumpKey] = useState(0)
  const topRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const {
    status,
    dueMeds,
    doneMeds,
    pendingFeedings,
    toothbrushingDue,
    hasPending,
    hasAnyTasks,
  } = summarizeCatTasks(cat, windowEvents, allMedEvents, memberMap, currentUserId, requirements)

  const coat = coatForCat(cat)
  const isBirthday = isCatBirthday(cat.birthday)
  const age = getCatAge(cat.birthday)
  const mood: CatMood = isBirthday
    ? 'party'
    : pendingFeedings > 0 || dueMeds.length > 0
      ? 'hungry'
      : hasAnyTasks && !hasPending
        ? 'sleep'
        : 'happy'

  const bubble = dueMeds.length > 0
    ? 'Pill time? 💊'
    : pendingFeedings > 0
      ? 'Mrrp? 🍽️'
      : toothbrushingDue
        ? 'Teeth time 🪥'
        : null

  const statusText = hasPending
    ? [
        pendingFeedings > 0 && (pendingFeedings > 1 ? `${pendingFeedings} meals to go` : 'Needs a meal'),
        dueMeds.length > 0 && `${dueMeds.length} med${dueMeds.length > 1 ? 's' : ''} due`,
        toothbrushingDue && 'Teeth',
      ].filter(Boolean).join(' · ')
    : 'All caught up'

  // Celebrate the moment the last pending task gets logged (not on first render).
  const prevPending = useRef(hasPending)
  useEffect(() => {
    if (prevPending.current && !hasPending) {
      floatEmoji(topRef.current, ['💛', '🧡', '💕'], 8)
      setJumpKey((k) => k + 1)
    }
    prevPending.current = hasPending
  }, [hasPending])

  function pet() {
    floatEmoji(topRef.current, ['💕', '💗', '😻'], 5)
    setJumpKey((k) => k + 1)
  }

  function handleTilt(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse' || prefersReducedMotion()) return
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `perspective(900px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-3px)`
  }

  function resetTilt() {
    if (cardRef.current) cardRef.current.style.transform = ''
  }

  const extraFeeds = Math.max(0, status.feedCount - status.feedingsNeeded)

  return (
    <div
      ref={cardRef}
      onPointerMove={handleTilt}
      onPointerLeave={resetTilt}
      style={{ '--pl-i': index } as React.CSSProperties}
      className={[
        'pl-card pl-card-in relative overflow-hidden rounded-3xl border bg-card',
        isBirthday ? 'pl-card-bday' : '',
      ].join(' ')}
    >
      {/* Illustrated header — tap the cat to pet it */}
      <div
        ref={topRef}
        className="pl-card-top relative flex h-36 items-end justify-center"
        style={{ '--pl-tint-a': coat.tint[0], '--pl-tint-b': coat.tint[1] } as React.CSSProperties}
      >
        {isBirthday && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-pink-500 px-2.5 py-1 text-xs font-bold text-white">
            🎂 {age ? `${age} today` : 'Birthday!'}
          </span>
        )}
        {cat.photo_url && !isBirthday && (
          <button
            onClick={() => navigate(`/households/${cat.household_id}/cats/${cat.id}`)}
            aria-label={`View ${cat.name}'s profile`}
            className="absolute left-3 top-3 z-10 size-10 overflow-hidden rounded-full ring-2 ring-white/80 shadow-sm transition-transform hover:scale-110"
          >
            <img src={cat.photo_url} alt="" className="size-full object-cover" />
          </button>
        )}
        {bubble && <span className="pl-bubble absolute right-3 top-3 z-10">{bubble}</span>}
        <button
          type="button"
          onClick={pet}
          aria-label={`Pet ${cat.name}`}
          className="pl-cat-stage relative z-[1] mb-1.5 h-[112px] w-[118px]"
        >
          <span key={jumpKey} className={`block size-full ${jumpKey > 0 ? 'pl-jump' : ''}`}>
            <AnimatedCat coat={coat} mood={mood} className="size-full" />
          </span>
        </button>
      </div>

      <div className="px-4 pb-4 pt-3">
        {/* Name (→ profile) + status pill */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => navigate(`/households/${cat.household_id}/cats/${cat.id}`)}
            aria-label={`View ${cat.name}'s profile`}
            className="min-w-0 truncate text-left font-display text-xl hover:text-primary transition-colors"
          >
            {cat.name}
          </button>
          <span
            className={[
              'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold transition-colors',
              hasPending
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
            ].join(' ')}
          >
            {hasPending ? statusText : '✓ All caught up'}
          </span>
        </div>

        {/* Trackers */}
        {hasAnyTasks && (
          <div className="mt-3 space-y-2 text-sm font-semibold text-muted-foreground">
            {status.feedingsNeeded > 0 && (
              <div className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs">Meals</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {Array.from({ length: status.feedingsNeeded }, (_, i) => (
                    <span
                      key={`${i}-${i < status.feedCount}`}
                      className={`pl-bowl ${i < status.feedCount ? 'pl-bowl-full' : ''}`}
                      style={{ '--pl-c': EVENT_COLORS.feeding } as React.CSSProperties}
                      aria-hidden="true"
                    >
                      {i < status.feedCount ? '🍗' : ''}
                    </span>
                  ))}
                  {extraFeeds > 0 && <span className="text-xs">+{extraFeeds}</span>}
                  <span className="sr-only">{status.feedCount} of {status.feedingsNeeded} feedings</span>
                </div>
              </div>
            )}

            {(status.trackToothbrushing || dueMeds.length > 0 || doneMeds.length > 0) && (
              <div className="flex items-start gap-3">
                <span className="w-14 shrink-0 pt-1 text-xs">Today</span>
                <div className="flex flex-wrap gap-1.5">
                  {status.trackToothbrushing && (
                    <span
                      className={`pl-chip ${toothbrushingDue ? '' : 'pl-chip-done'}`}
                      style={{ '--pl-c': EVENT_COLORS.tooth_brushing } as React.CSSProperties}
                    >
                      🪥 {toothbrushingDue ? 'Teeth?' : 'Teeth'}
                    </span>
                  )}
                  {dueMeds.map((med) => {
                    const { dosage, unit } = getMedicationStartDetails(cat.id, med.name, allMedEvents)
                    return (
                      <button
                        key={med.name}
                        onClick={() => onLog(cat, 'medication', { medicationName: med.name, medicationDosage: dosage, medicationUnit: unit })}
                        aria-label={`Log ${med.name} for ${cat.name}`}
                        className="pl-chip pl-chip-due"
                        style={{ '--pl-c': EVENT_COLORS.medication } as React.CSSProperties}
                      >
                        💊 {med.dosesNeededToday > 1 && `${med.dosesGivenToday}/${med.dosesNeededToday} `}{med.name}
                      </button>
                    )
                  })}
                  {doneMeds.map((med) => (
                    <span
                      key={med.name}
                      className="pl-chip pl-chip-done"
                      style={{ '--pl-c': EVENT_COLORS.medication } as React.CSSProperties}
                    >
                      💊 {med.dosesNeededToday > 1 && `${med.dosesGivenToday}/${med.dosesNeededToday} `}{med.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick actions */}
        <div className="mt-4 flex gap-1.5" role="group" aria-label={`Quick actions for ${cat.name}`}>
          <QuickAction emoji="🍗" label="Feed" color={EVENT_COLORS.feeding} onClick={() => onLog(cat, 'feeding')} ariaLabel={`Log feeding for ${cat.name}`} />
          {status.trackToothbrushing && (
            <QuickAction emoji="🪥" label="Teeth" color={EVENT_COLORS.tooth_brushing} onClick={() => onLog(cat, 'tooth_brushing')} ariaLabel={`Log tooth brushing for ${cat.name}`} />
          )}
          <QuickAction emoji="✨" label="Log" color="var(--muted-foreground)" onClick={() => onLog(cat)} ariaLabel={`Log care for ${cat.name}`} />
        </div>
      </div>

      {hasCatCareInfo(cat, careNotes) && (
        <div className="border-t border-border/60">
          <button
            onClick={() => setCareOpen((v) => !v)}
            aria-expanded={careOpen}
            aria-controls={`care-info-${cat.id}`}
            className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <Info className="size-3.5" />
              Care instructions
            </span>
            {careOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          {careOpen && <CatCareInfo cat={cat} careNotes={careNotes} />}
        </div>
      )}
    </div>
  )
}

function QuickAction({ emoji, label, color, onClick, ariaLabel }: {
  emoji: string
  label: string
  color: string
  onClick: () => void
  ariaLabel: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="pl-act"
      style={{ '--pl-c': color } as React.CSSProperties}
    >
      <span className="pl-act-emoji" aria-hidden="true">{emoji}</span>
      {label}
    </button>
  )
}
