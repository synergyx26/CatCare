import type { Cat, CatStats, CareEvent, CareNote } from '@/types/api'

export interface MedicationRow {
  date: string
  name: string
  dosage: string
  unit: string
  notes: string | null
}

export interface VetVisitRow {
  date: string
  reason: string
  vet_name: string
  vet_clinic: string
  notes: string | null
}

export interface VetSummaryData {
  cat: Cat
  stats: CatStats
  medicationRows: MedicationRow[]
  vetVisitRows: VetVisitRow[]
  careNotes: CareNote[]
  generatedAt: string
}

/**
 * Assembles raw query results into a structured VetSummaryData object.
 * Filters medication and vet_visit events to the stats date range (start_date..end_date).
 * The getCareEvents endpoint returns all-time events, so we slice to the chosen period here.
 */
export function assembleVetSummary(
  cat: Cat,
  stats: CatStats,
  medicationEvents: CareEvent[],
  vetVisitEvents: CareEvent[],
  careNotes: CareNote[],
): VetSummaryData {
  const rangeStart = new Date(stats.start_date).getTime()
  const rangeEnd   = new Date(stats.end_date).getTime()

  const inRange = (e: CareEvent) => {
    const t = new Date(e.occurred_at).getTime()
    return t >= rangeStart && t <= rangeEnd
  }

  const medicationRows: MedicationRow[] = medicationEvents
    .filter(inRange)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .map((e) => {
      const d = e.details as Record<string, unknown>
      return {
        date:   formatDateShort(e.occurred_at),
        name:   (d.medication_name as string) || '—',
        dosage: (d.dosage as string) || '—',
        unit:   (d.unit   as string) || '',
        notes:  e.notes,
      }
    })

  const vetVisitRows: VetVisitRow[] = vetVisitEvents
    .filter(inRange)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .map((e) => {
      const d = e.details as Record<string, unknown>
      return {
        date:       formatDateShort(e.occurred_at),
        reason:     (d.reason      as string) || '—',
        vet_name:   (d.vet_name    as string) || cat.vet_name    || '—',
        vet_clinic: (d.vet_clinic  as string) || cat.vet_clinic  || '—',
        notes:      e.notes,
      }
    })

  // Filter care notes to cat-specific ones (null cat_id = household-level, exclude from vet summary)
  const catNotes = careNotes.filter((n) => n.cat_id === cat.id)

  return {
    cat,
    stats,
    medicationRows,
    vetVisitRows,
    careNotes: catNotes,
    generatedAt: new Date().toISOString(),
  }
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function formatDateRange(stats: CatStats): string {
  const start = formatDateShort(stats.start_date)
  const end   = formatDateShort(stats.end_date)
  return `${start} – ${end}`
}
