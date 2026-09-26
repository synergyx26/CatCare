import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UtensilsCrossed, Pill, ChevronDown, ChevronUp, Info, AlertCircle, CheckCircle2, Plus } from 'lucide-react'
import type { Cat, CareEvent, CareNote, EventType } from '@/types/api'
import type { CatCareRequirements } from '@/lib/helpers'
import {
  summarizeCatTasks,
  getMedicationStartDetails,
  hasCatCareInfo,
  CatCareInfo,
  ToothIcon,
} from './catTaskSummary'

interface CatTaskCardProps {
  cat: Cat
  windowEvents: CareEvent[]
  allMedEvents: CareEvent[]
  memberMap: Map<number, string>
  currentUserId: number
  requirements: CatCareRequirements | undefined
  onLog: (cat: Cat, type?: EventType, opts?: { medicationName?: string; medicationDosage?: string; medicationUnit?: string }) => void
  careNotes?: CareNote[]
}

export function CatTaskCard({
  cat,
  windowEvents,
  allMedEvents,
  memberMap,
  currentUserId,
  requirements,
  onLog,
  careNotes = [],
}: CatTaskCardProps) {
  const [careOpen, setCareOpen] = useState(false)
  const navigate = useNavigate()

  const {
    status,
    dueMeds,
    doneMeds,
    pendingFeedings,
    toothbrushingDue,
    hasPending,
    hasAnyTasks,
  } = summarizeCatTasks(cat, windowEvents, allMedEvents, memberMap, currentUserId, requirements)

  const hasCareInfo = hasCatCareInfo(cat, careNotes)

  return (
    <div className={[
      'rounded-2xl border bg-card transition-shadow',
      hasPending
        ? 'border-amber-200 dark:border-amber-800/40 shadow-sm shadow-amber-100/50 dark:shadow-amber-950/20'
        : 'border-emerald-200 dark:border-emerald-800/30',
    ].join(' ')}>
      {/* Card header: avatar (nav) + name/status (nav) + ad-hoc log button */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 w-full">
        {/* Avatar — navigates to profile */}
        <button
          onClick={() => navigate(`/households/${cat.household_id}/cats/${cat.id}`)}
          aria-label={`View ${cat.name}'s profile`}
          tabIndex={-1}
          className="shrink-0 hover:opacity-90 transition-opacity"
        >
          <div className={[
            'rounded-xl overflow-hidden',
            'ring-2',
            hasPending ? 'ring-amber-400 dark:ring-amber-500' : 'ring-emerald-400 dark:ring-emerald-500',
          ].join(' ')}>
            {cat.photo_url ? (
              <img
                src={cat.photo_url}
                alt={cat.name}
                className="size-14 object-cover"
              />
            ) : (
              <div className="size-14 flex items-center justify-center bg-gradient-to-br from-sky-100 to-sky-200 dark:from-sky-900/40 dark:to-sky-800/40 text-xl font-bold text-sky-600 dark:text-sky-400">
                {cat.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </button>

        {/* Name + status — navigates to profile */}
        <button
          onClick={() => navigate(`/households/${cat.household_id}/cats/${cat.id}`)}
          aria-label={`View ${cat.name}'s profile`}
          className="flex-1 min-w-0 text-left hover:bg-muted/40 transition-colors rounded-xl px-1 -mx-1 py-0.5"
        >
          <p className="font-semibold text-base leading-tight truncate">{cat.name}</p>
          {hasPending ? (
            <div className="flex items-center gap-1 mt-0.5">
              <AlertCircle className="size-3.5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                {[
                  pendingFeedings > 0 && (pendingFeedings > 1
                    ? `${pendingFeedings} feedings needed`
                    : 'Needs feeding'),
                  dueMeds.length > 0 && `${dueMeds.length} med${dueMeds.length > 1 ? 's' : ''} due`,
                  toothbrushingDue && 'Teeth pending',
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">All done</p>
            </div>
          )}
        </button>

        {/* Ad-hoc / general care log button */}
        <button
          onClick={() => onLog(cat)}
          aria-label={`Log care for ${cat.name}`}
          className="shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors active:scale-95"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Log
        </button>
      </div>

      {/* Task rows — always shown so completed tasks remain visible */}
      {hasAnyTasks && (
        <div className="px-4 pb-3 space-y-2">
          {/* Feedings */}
          {status.feedingsNeeded > 0 && (
            pendingFeedings > 0 ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-sm font-medium">
                    {status.feedingsNeeded > 1
                      ? `${status.feedCount}/${status.feedingsNeeded} feedings`
                      : 'Feeding'}
                  </span>
                </div>
                <button
                  onClick={() => onLog(cat, 'feeding')}
                  aria-label={`Log feeding for ${cat.name}`}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 dark:hover:bg-amber-900/70 text-amber-700 dark:text-amber-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <UtensilsCrossed className="size-3.5" />
                  Log
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="size-4 text-emerald-500 shrink-0" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    {status.feedingsNeeded > 1
                      ? `${status.feedCount}/${status.feedingsNeeded} feedings`
                      : 'Fed'}
                  </span>
                </div>
                <CheckCircle2 className="size-5 text-emerald-500 shrink-0" aria-label="Done" />
              </div>
            )
          )}

          {/* Teeth */}
          {status.trackToothbrushing && (
            toothbrushingDue ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-primary/5 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <ToothIcon className="size-4 text-primary shrink-0" />
                  <span className="text-sm font-medium">Tooth brushing</span>
                </div>
                <button
                  onClick={() => onLog(cat, 'tooth_brushing')}
                  aria-label={`Log tooth brushing for ${cat.name}`}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors cursor-pointer"
                >
                  Log
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <ToothIcon className="size-4 text-emerald-500 shrink-0" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Tooth brushing</span>
                </div>
                <CheckCircle2 className="size-5 text-emerald-500 shrink-0" aria-label="Done" />
              </div>
            )
          )}

          {/* Pending medications */}
          {dueMeds.map(med => {
            const { dosage: medDosage, unit: medUnit } = getMedicationStartDetails(cat.id, med.name, allMedEvents)
            return (
              <div
                key={med.name}
                className="flex items-center justify-between gap-3 rounded-xl bg-red-50 dark:bg-red-950/20 px-3 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Pill className="size-4 text-red-500 shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {med.name}
                    {medDosage && (
                      <span className="text-xs text-muted-foreground ml-1.5">{medDosage}{medUnit ? ` ${medUnit}` : ''}</span>
                    )}
                    {med.dosesNeededToday > 1 && (
                      <span className="text-xs text-red-600 dark:text-red-400 ml-1.5">
                        ({med.dosesGivenToday}/{med.dosesNeededToday})
                      </span>
                    )}
                  </span>
                </div>
                <button
                  onClick={() => onLog(cat, 'medication', { medicationName: med.name, medicationDosage: medDosage, medicationUnit: medUnit })}
                  aria-label={`Log ${med.name} for ${cat.name}`}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900/70 text-red-700 dark:text-red-300 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  <Pill className="size-3.5" />
                  Log
                </button>
              </div>
            )
          })}

          {/* Completed medications */}
          {doneMeds.map(med => (
            <div
              key={med.name}
              className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Pill className="size-4 text-emerald-500 shrink-0" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 truncate">
                  {med.name}
                  {med.dosesNeededToday > 1 && (
                    <span className="text-xs ml-1.5">
                      ({med.dosesGivenToday}/{med.dosesNeededToday})
                    </span>
                  )}
                </span>
              </div>
              <CheckCircle2 className="size-5 text-emerald-500 shrink-0" aria-label="Done" />
            </div>
          ))}
        </div>
      )}

      {/* Care instructions toggle */}
      {hasCareInfo && (
        <div className="border-t border-border/60">
          <button
            onClick={() => setCareOpen((v) => !v)}
            aria-expanded={careOpen}
            aria-controls={`care-info-${cat.id}`}
            className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
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
