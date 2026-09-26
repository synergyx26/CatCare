import { getCatTodayStatus, getActiveMedicationTasks, type CatCareRequirements, type CatTodayStatus, type MedicationTask } from '@/lib/helpers'
import { CARE_NOTE_CATEGORY_COLORS, CARE_NOTE_CATEGORY_LABELS } from '@/lib/careNoteCategories'
import type { Cat, CareEvent, CareNote } from '@/types/api'

// Shared by CatTaskCard (classic) and PlayfulCatCard (redesign preview) so
// both dashboards agree on what's pending and log medications identically.

export function ToothIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 3h6a2 2 0 0 1 2 2c0 1.5-1 3-1 5 0 4-1 11-2.5 11-.8 0-1.2-1.5-1.5-1.5s-.7 1.5-1.5 1.5C9 21 8 14 8 10c0-2-1-3.5-1-5a2 2 0 0 1 2-2z" />
    </svg>
  )
}

export interface CatTaskSummary {
  status: CatTodayStatus
  allActiveMeds: MedicationTask[]
  dueMeds: MedicationTask[]
  doneMeds: MedicationTask[]
  pendingFeedings: number
  toothbrushingDue: boolean
  hasPending: boolean
  hasAnyTasks: boolean
  /** Individual task units (each feeding, each dose, teeth) — drives progress rings. */
  totalTasks: number
  doneTasks: number
}

export function summarizeCatTasks(
  cat: Cat,
  windowEvents: CareEvent[],
  allMedEvents: CareEvent[],
  memberMap: Map<number, string>,
  currentUserId: number,
  requirements: CatCareRequirements | undefined,
): CatTaskSummary {
  const status = getCatTodayStatus(cat.id, windowEvents, memberMap, currentUserId, requirements, allMedEvents)
  const allActiveMeds = getActiveMedicationTasks(cat.id, allMedEvents)
    .filter(t => t.dosesNeededToday > 0)
  const dueMeds = allActiveMeds.filter(t => t.dosesGivenToday < t.dosesNeededToday)
  const doneMeds = allActiveMeds.filter(t => t.dosesGivenToday >= t.dosesNeededToday)

  const pendingFeedings = Math.max(0, status.feedingsNeeded - status.feedCount)
  const toothbrushingDue = status.trackToothbrushing && !status.toothbrushingDoneAt

  const totalTasks = status.feedingsNeeded
    + (status.trackToothbrushing ? 1 : 0)
    + allActiveMeds.reduce((sum, m) => sum + m.dosesNeededToday, 0)
  const doneTasks = Math.min(status.feedCount, status.feedingsNeeded)
    + (status.trackToothbrushing && !toothbrushingDue ? 1 : 0)
    + allActiveMeds.reduce((sum, m) => sum + Math.min(m.dosesGivenToday, m.dosesNeededToday), 0)

  return {
    status,
    allActiveMeds,
    dueMeds,
    doneMeds,
    pendingFeedings,
    toothbrushingDue,
    hasPending: pendingFeedings > 0 || dueMeds.length > 0 || toothbrushingDue,
    hasAnyTasks: status.feedingsNeeded > 0 || status.trackToothbrushing || allActiveMeds.length > 0,
    totalTasks,
    doneTasks,
  }
}

/** Dosage/unit from the newest non-stopped regimen start event, to pre-fill a dose log. */
export function getMedicationStartDetails(
  catId: number,
  medName: string,
  allMedEvents: CareEvent[],
): { dosage?: string; unit?: string } {
  const startEvt = allMedEvents
    .filter(e => {
      const d = e.details as Record<string, unknown>
      return e.cat_id === catId && d.active_medication === true && d.medication_name === medName && d.stopped !== true
    })
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())[0]
  if (!startEvt) return {}
  const d = startEvt.details as Record<string, unknown>
  return { dosage: d.dosage as string | undefined, unit: d.unit as string | undefined }
}

export function hasCatCareInfo(cat: Cat, careNotes: CareNote[]): boolean {
  return careNotes.length > 0 || !!(cat.vet_name || cat.vet_phone)
}

/** Expanded body of the "Care instructions" toggle: care notes + the cat's vet. */
export function CatCareInfo({ cat, careNotes }: { cat: Cat; careNotes: CareNote[] }) {
  return (
    <div id={`care-info-${cat.id}`} className="px-4 pb-4 space-y-2">
      {careNotes.map(note => (
        <div
          key={note.id}
          className="rounded-xl border border-border/60 bg-card p-3 space-y-1"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-block size-2 rounded-full shrink-0"
              style={{ backgroundColor: CARE_NOTE_CATEGORY_COLORS[note.category] }}
            />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {CARE_NOTE_CATEGORY_LABELS[note.category]}
            </p>
          </div>
          <p className="text-sm font-medium leading-snug">{note.title}</p>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {note.body}
          </p>
        </div>
      ))}

      {(cat.vet_name || cat.vet_phone) && (
        <div className="rounded-xl bg-muted/50 px-3 py-2.5 space-y-0.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {cat.name}'s Vet
          </p>
          {cat.vet_clinic && <p className="text-sm">{cat.vet_clinic}</p>}
          {cat.vet_name && <p className="text-xs text-muted-foreground">{cat.vet_name}</p>}
          {cat.vet_phone && (
            <a
              href={`tel:${cat.vet_phone}`}
              className="flex items-center gap-1.5 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors min-h-[44px] py-1"
            >
              {cat.vet_phone}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
