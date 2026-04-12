import type { CareEvent, EventType, MedicationFrequency } from '@/types/api'

// Checks whether today (local time) is a cat's birthday (same month + day).
// Parses birthday as a local date to avoid UTC-midnight timezone shifts.
export function isCatBirthday(birthday: string | null): boolean {
  if (!birthday) return false
  const today = new Date()
  const parts = birthday.split('-').map(Number)
  if (parts.length < 3) return false
  const [, month, day] = parts
  return month === today.getMonth() + 1 && day === today.getDate()
}

// Returns the cat's age in full years, or null if birthday is unknown.
export function getCatAge(birthday: string | null): number | null {
  if (!birthday) return null
  const parts = birthday.split('-').map(Number)
  if (parts.length < 3) return null
  const [year, month, day] = parts
  const today = new Date()
  let age = today.getFullYear() - year
  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age--
  }
  return age >= 0 ? age : null
}

// ─── Vacation Mode ────────────────────────────────────────────────────────────

export interface VacationContext {
  active: boolean
  windowDays: number
  startDate: string  // trip.start_date "YYYY-MM-DD"
}

export function isWithinLastNDays(isoString: string, days: number): boolean {
  const d = new Date(isoString)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  cutoff.setHours(0, 0, 0, 0)
  return d >= cutoff
}

export function isToday(isoString: string): boolean {
  const d = new Date(isoString)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function isSameLocalDay(isoString: string, date: Date): boolean {
  const d = new Date(isoString)
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  )
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateHeader(): string {
  return new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function formatEventSummary(event: CareEvent): string {
  const d = event.details as Record<string, unknown>
  switch (event.event_type) {
    case 'feeding': {
      const labels: Record<string, string> = {
        wet: 'Wet',
        dry: 'Dry',
        treats: 'Treats',
        other: 'Other',
      }
      const type = labels[d.food_type as string] ?? (d.food_type as string) ?? ''
      const amount = d.amount_grams != null ? ` · ${d.amount_grams}g` : ''
      return `${type}${amount}`
    }
    case 'litter':
      return 'Litter cleaned'
    case 'water':
      return 'Water refreshed'
    case 'weight': {
      if (d.weight_value == null) return 'Weight'
      return `${d.weight_value} ${d.weight_unit ?? 'kg'}`
    }
    case 'medication': {
      const name = d.medication_name as string
      const dosage = d.dosage as string
      const unit = d.unit as string
      if (!name) return 'Medication'
      return dosage ? `${name} · ${dosage} ${unit}` : name
    }
    case 'vet_visit': {
      const reason = d.reason as string
      return reason ? `Vet · ${reason}` : 'Vet visit'
    }
    case 'grooming': {
      const groomingLabels: Record<string, string> = {
        bath: 'Bath',
        nail_trim: 'Nail trim',
        full_groom: 'Full groom',
        other: 'Grooming',
      }
      return groomingLabels[d.grooming_type as string] ?? 'Grooming'
    }
    case 'note':
      return 'Note'
    case 'tooth_brushing':
      return 'Toothbrushing'
    case 'symptom': {
      const symptomLabels: Record<string, string> = {
        vomiting:      'Vomiting',
        coughing:      'Coughing',
        asthma_attack: 'Breathing issue',
        sneezing:      'Sneezing',
        diarrhea:      'Diarrhea',
        lethargy:      'Lethargy',
        not_eating:    'Not eating',
        limping:       'Limping',
        eye_discharge: 'Eye discharge',
        seizure:       'Seizure',
        other:         'Symptom',
      }
      const type     = symptomLabels[d.symptom_type as string] ?? 'Symptom'
      const severity = d.severity ? ` · ${(d.severity as string).charAt(0).toUpperCase()}${(d.severity as string).slice(1)}` : ''
      return `${type}${severity}`
    }
    default:
      return event.event_type
  }
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  feeding:   'Feeding',
  litter:    'Litter',
  water:     'Water',
  weight:    'Weight',
  note:      'Note',
  medication: 'Medication',
  vet_visit: 'Vet visit',
  grooming:  'Grooming',
  symptom:        'Symptom',
  tooth_brushing: 'Toothbrushing',
}

// ─── Medication Adherence Helpers ─────────────────────────────────────────────

const FREQUENCY_HOURS: Record<MedicationFrequency, number | null> = {
  once_daily:      24,
  twice_daily:     12,
  every_8h:        8,
  every_12h:       12,
  as_needed:       null,
  every_other_day: 48,
  every_3_days:    72,
  every_week:      168,
}

// Doses required per calendar day for intra-day frequencies
const DOSES_PER_DAY: Partial<Record<MedicationFrequency, number>> = {
  once_daily:  1,
  twice_daily: 2,
  every_8h:    3,
  every_12h:   2,
}

// Calendar-day interval for multi-day frequencies
const INTERVAL_DAYS: Partial<Record<MedicationFrequency, number>> = {
  every_other_day: 2,
  every_3_days:    3,
  every_week:      7,
}

export interface MedicationTask {
  name: string
  frequency: MedicationFrequency
  dosesNeededToday: number
  dosesGivenToday: number
}

/**
 * Returns active medication tasks for a cat for today.
 * Handles both intra-day frequencies (once/twice/3x/2x daily) and
 * multi-day intervals (every other day, every 3 days, weekly).
 * allMedEvents must contain ALL medication events for the household
 * (no date filter), sorted any order.
 */
export function getActiveMedicationTasks(
  catId: number,
  allMedEvents: CareEvent[],
): MedicationTask[] {
  const catEvents = allMedEvents
    .filter(e => e.cat_id === catId)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

  // Determine active medications: newest start event per name, not stopped
  // Store startedAt so we can ignore doses that predate the current regimen
  const processedNames = new Set<string>()
  const activeMeds = new Map<string, { frequency: MedicationFrequency | null; startedAt: number }>()

  for (const event of catEvents) {
    const d = event.details as Record<string, unknown>
    if (d.active_medication !== true) continue
    const name = (d.medication_name as string) || 'Unknown medication'
    if (processedNames.has(name)) continue
    processedNames.add(name)
    if (d.stopped !== true) {
      activeMeds.set(name, {
        frequency: (d.frequency as MedicationFrequency) ?? null,
        startedAt: new Date(event.occurred_at).getTime(),
      })
    }
  }

  if (activeMeds.size === 0) return []

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const tasks: MedicationTask[] = []

  for (const [name, { frequency, startedAt }] of activeMeds.entries()) {
    if (!frequency || frequency === 'as_needed') continue

    // Only count doses that belong to this regimen (at or after the start event)
    const dosesGivenToday = catEvents.filter(e => {
      const d = e.details as Record<string, unknown>
      if (d.active_medication === true) return false
      if ((d.medication_name as string) !== name) return false
      const t = new Date(e.occurred_at).getTime()
      return t >= todayStart.getTime() && t <= todayEnd.getTime() && t >= startedAt
    }).length

    let dosesNeededToday: number

    if (DOSES_PER_DAY[frequency] !== undefined) {
      dosesNeededToday = DOSES_PER_DAY[frequency]!
    } else if (INTERVAL_DAYS[frequency] !== undefined) {
      const intervalDays = INTERVAL_DAYS[frequency]!
      // Only consider doses on or after the start event
      const lastDose = catEvents.find(e => {
        const d = e.details as Record<string, unknown>
        if (d.active_medication === true) return false
        if ((d.medication_name as string) !== name) return false
        return new Date(e.occurred_at).getTime() >= startedAt
      })
      if (!lastDose) {
        dosesNeededToday = 1
      } else {
        const lastDoseDay = new Date(lastDose.occurred_at)
        lastDoseDay.setHours(0, 0, 0, 0)
        const daysSince = Math.floor(
          (todayStart.getTime() - lastDoseDay.getTime()) / (24 * 60 * 60 * 1000)
        )
        dosesNeededToday = daysSince >= intervalDays ? 1 : 0
      }
    } else {
      continue
    }

    tasks.push({ name, frequency, dosesNeededToday, dosesGivenToday })
  }

  return tasks
}

/**
 * Returns a human-readable label for when the next dose is due.
 * Returns null for "as_needed" or when frequency is unknown.
 */
export function getNextDoseLabel(
  frequency: MedicationFrequency | null | undefined,
  lastDoseAt: string | null | undefined
): string | null {
  if (!frequency || !lastDoseAt) return null
  const intervalHours = FREQUENCY_HOURS[frequency]
  if (intervalHours === null) return null

  const lastMs = new Date(lastDoseAt).getTime()
  const nextMs = lastMs + intervalHours * 60 * 60 * 1000
  const nowMs = Date.now()
  const diffMs = nextMs - nowMs
  const diffHours = diffMs / (60 * 60 * 1000)

  if (diffMs <= 0) {
    const overdueHours = Math.abs(diffHours)
    if (overdueHours < 1) return 'Due now'
    return `Overdue by ~${Math.round(overdueHours)}h`
  }
  if (diffHours < 1) return 'Due in < 1h'
  return `Due in ~${Math.round(diffHours)}h`
}

export type DoseTimelineRow =
  | { type: 'dose'; event: CareEvent }
  | { type: 'missed'; expectedAt: string }

/**
 * Builds a unified dose timeline for a single medication.
 * Inserts "missed" rows wherever a dose gap exceeds the expected interval.
 * startAt is the occurred_at of the "start" event (active_medication: true).
 * doses should be sorted newest-first on entry; output is also newest-first.
 */
export function buildDoseTimeline(
  frequency: MedicationFrequency | null | undefined,
  startAt: string,
  doses: CareEvent[]
): DoseTimelineRow[] {
  const intervalHours = frequency ? FREQUENCY_HOURS[frequency] : null

  // Sort oldest-first to walk chronologically
  const sorted = [...doses].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  )

  const rows: DoseTimelineRow[] = []

  if (!intervalHours) {
    // No frequency — just return doses as-is (newest-first)
    for (const event of [...sorted].reverse()) {
      rows.push({ type: 'dose', event })
    }
    return rows
  }

  const intervalMs = intervalHours * 60 * 60 * 1000
  const now = Date.now()
  const startMs = new Date(startAt).getTime()

  // Walk from start to now in expected dose slots, inserting missed rows
  let expectedMs = startMs + intervalMs
  let doseIndex = 0

  while (expectedMs <= now + intervalMs) {
    const dose = sorted[doseIndex]
    if (dose) {
      const doseMs = new Date(dose.occurred_at).getTime()
      if (doseMs <= expectedMs + intervalMs / 2) {
        // Close enough — counts as the expected dose
        rows.push({ type: 'dose', event: dose })
        doseIndex++
        expectedMs += intervalMs
        continue
      }
    }
    // No dose found near this slot — it's missed (only flag past slots)
    if (expectedMs < now - intervalMs / 4) {
      rows.push({ type: 'missed', expectedAt: new Date(expectedMs).toISOString() })
    }
    expectedMs += intervalMs
  }

  // Any remaining doses (e.g., extra doses in a slot) append at the end
  while (doseIndex < sorted.length) {
    rows.push({ type: 'dose', event: sorted[doseIndex] })
    doseIndex++
  }

  // Return newest-first
  return rows.reverse()
}

export interface CatCareRequirements {
  feedings_per_day: number
  track_water: boolean
  track_litter: boolean
  track_toothbrushing: boolean
}

export interface CatTodayStatus {
  feedCount: number
  feedingsNeeded: number
  lastFedAt: string | null
  lastFedBy: string | null
  litterDoneAt: string | null
  waterDoneAt: string | null
  trackWater: boolean
  trackLitter: boolean
  trackToothbrushing: boolean
  toothbrushingDoneAt: string | null
  recentSymptomAt: string | null
  medicationTasks: MedicationTask[]
}

export function getCatTodayStatus(
  catId: number,
  todayEvents: CareEvent[],
  memberMap: Map<number, string>,
  currentUserId: number,
  requirements?: CatCareRequirements,
  allMedEvents?: CareEvent[],
): CatTodayStatus {
  const catEvents = todayEvents.filter((e) => e.cat_id === catId)

  const feedings = catEvents
    .filter((e) => {
      if (e.event_type !== 'feeding') return false
      // Treats are a supplement — they don't count toward the daily feeding requirement
      const d = e.details as Record<string, unknown>
      return d?.food_type !== 'treats'
    })
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    )

  const lastLitter = catEvents
    .filter((e) => e.event_type === 'litter')
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    )[0]

  const lastWater = catEvents
    .filter((e) => e.event_type === 'water')
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    )[0]

  const lastSymptom = catEvents
    .filter((e) => e.event_type === 'symptom')
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    )[0]

  const lastToothbrushing = catEvents
    .filter((e) => e.event_type === 'tooth_brushing')
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    )[0]

  const lastFeeding = feedings[0]
  let lastFedBy: string | null = null
  if (lastFeeding) {
    const name = memberMap.get(lastFeeding.logged_by_id)
    lastFedBy =
      lastFeeding.logged_by_id === currentUserId ? 'You' : (name ?? 'Someone')
  }

  return {
    feedCount: feedings.length,
    feedingsNeeded: requirements?.feedings_per_day ?? 1,
    lastFedAt: lastFeeding?.occurred_at ?? null,
    lastFedBy,
    litterDoneAt: lastLitter?.occurred_at ?? null,
    waterDoneAt: lastWater?.occurred_at ?? null,
    trackWater:          requirements?.track_water ?? true,
    trackLitter:         requirements?.track_litter ?? true,
    trackToothbrushing:  requirements?.track_toothbrushing ?? false,
    toothbrushingDoneAt: lastToothbrushing?.occurred_at ?? null,
    recentSymptomAt:     lastSymptom?.occurred_at ?? null,
    medicationTasks:     allMedEvents ? getActiveMedicationTasks(catId, allMedEvents) : [],
  }
}
