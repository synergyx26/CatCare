import type { CareEvent, EventType, MedicationFrequency, HouseholdChore, HouseholdChoreDefinition } from '@/types/api'

export function isCatBirthday(birthday: string | null): boolean {
  if (!birthday) return false
  const parts = birthday.split('-').map(Number)
  if (parts.length < 3) return false
  const today = new Date()
  const [, month, day] = parts
  return month === today.getMonth() + 1 && day === today.getDate()
}

// Parses a YYYY-MM-DD string as local midnight, avoiding the UTC-shift
// that `new Date("YYYY-MM-DD")` introduces for users west of UTC.
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function getCatAge(birthday: string | null): number | null {
  if (!birthday) return null
  const parts = birthday.split('-').map(Number)
  if (parts.length < 3) return null
  const [year, month, day] = parts
  const today = new Date()
  let age = today.getFullYear() - year
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--
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
    case 'weight': {
      if (d.weight_value == null) return 'Weight'
      return `${d.weight_value} ${d.weight_unit ?? 'kg'}`
    }
    case 'medication': {
      const name = d.medication_name as string
      if (isMedicationRefill(event)) {
        const qty = d.supply_quantity != null ? ` · ${d.supply_quantity} ${(d.supply_unit as string) ?? ''}`.trimEnd() : ''
        return `${name || 'Medication'} · New supply${qty}`
      }
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
  weight:    'Weight',
  note:      'Note',
  medication: 'Medication',
  vet_visit: 'Vet visit',
  grooming:  'Grooming',
  symptom:        'Symptom',
  tooth_brushing: 'Toothbrushing',
}

// ─── Medication Adherence Helpers ─────────────────────────────────────────────

// A medication CareEvent is one of three things:
//   start event  — details.active_medication === true (regimen definition)
//   refill event — details.supply_refill === true (new pack/inhaler opened)
//   dose         — anything else
// Always classify through these helpers so refills never count as doses.

export function isMedicationRefill(event: CareEvent): boolean {
  return (event.details as Record<string, unknown>).supply_refill === true
}

export function isMedicationDose(event: CareEvent): boolean {
  const d = event.details as Record<string, unknown>
  return event.event_type === 'medication' && d.active_medication !== true && d.supply_refill !== true
}

/** End of the last day of a finite course (local time), or null when the course is open-ended. */
export function getCourseEndMs(details: Record<string, unknown>): number | null {
  const end = details.course_end_date
  if (typeof end !== 'string' || !end) return null
  const d = parseLocalDate(end)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

/** True once the final day of a finite course has passed. Open-ended regimens never finish. */
export function isMedicationCourseOver(details: Record<string, unknown>, now = Date.now()): boolean {
  const endMs = getCourseEndMs(details)
  return endMs !== null && now > endMs
}

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
 * (no date filter), sorted any order. Excluded if start date is future
 * or course_end_date is past (both compared as local calendar days).
 */
export function getActiveMedicationTasks(
  catId: number,
  allMedEvents: CareEvent[],
): MedicationTask[] {
  const catEvents = allMedEvents
    .filter(e => e.cat_id === catId)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

  // Newest start event per name that isn't stopped. courseEndDate gates expiry.
  const processedNames = new Set<string>()
  const activeMeds = new Map<string, {
    frequency: MedicationFrequency | null
    startedAt: number
    courseEndDate: string | null
  }>()

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
        courseEndDate: (d.course_end_date as string) ?? null,
      })
    }
  }

  if (activeMeds.size === 0) return []

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const tasks: MedicationTask[] = []

  for (const [name, { frequency, startedAt, courseEndDate }] of activeMeds.entries()) {
    if (!frequency || frequency === 'as_needed') continue

    // Regimen bounds: exclude future-start and expired courses.
    if (new Date(startedAt).setHours(0, 0, 0, 0) > todayStart.getTime()) continue
    if (courseEndDate && todayStart.getTime() > parseLocalDate(courseEndDate).getTime()) continue

    // Only count doses that belong to this regimen (at or after the start event)
    const dosesGivenToday = catEvents.filter(e => {
      const d = e.details as Record<string, unknown>
      if (!isMedicationDose(e)) return false
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
        if (!isMedicationDose(e)) return false
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

// ─── Medication Supply Countdown ──────────────────────────────────────────────

/** Share of the counted quantity at which "reorder soon" kicks in when no explicit threshold is set. */
const DEFAULT_LOW_SUPPLY_FRACTION = 0.2

export interface MedicationSupply {
  unit: string
  /** Amount counted when the current supply started */
  quantity: number
  /** When the current supply started (ISO) */
  startedAt: string
  perDose: number
  /** Never negative — an over-count means the snapshot is stale, not that supply went below zero */
  remaining: number
  lowThreshold: number
  isLow: boolean
  isEmpty: boolean
  /** Whole days of supply left at the scheduled rate; null for as-needed / unknown frequency */
  daysLeft: number | null
}

/**
 * Derives remaining supply for a regimen. The current supply starts at the newest
 * count snapshot: the start event's initial count (supply_quantity at
 * supply_refilled_at) or a later refill event (supply_quantity at occurred_at).
 * Each dose logged at or after that moment consumes its supply_used (or the
 * regimen's supply_per_dose when the dose was logged from a surface that doesn't
 * set it). Derived rather than decremented so edited/deleted/backdated doses and
 * refills stay accurate. doses/refills must belong to this regimen (same
 * medication name, on/after the start event). Returns null when supply tracking
 * is off for the regimen.
 */
export function getMedicationSupply(
  startEvent: CareEvent,
  doses: CareEvent[],
  refills: CareEvent[] = []
): MedicationSupply | null {
  const d = startEvent.details as Record<string, unknown>
  const initialQuantity = Number(d.supply_quantity)
  const initialAt       = d.supply_refilled_at as string | undefined
  if (d.supply_quantity == null || !Number.isFinite(initialQuantity) || !initialAt) return null

  let quantity   = initialQuantity
  let refilledAt = initialAt
  for (const refill of refills) {
    const refillQuantity = Number((refill.details as Record<string, unknown>).supply_quantity)
    if (!Number.isFinite(refillQuantity)) continue
    if (new Date(refill.occurred_at).getTime() >= new Date(refilledAt).getTime()) {
      quantity   = refillQuantity
      refilledAt = refill.occurred_at
    }
  }

  const perDoseRaw = Number(d.supply_per_dose)
  const perDose    = Number.isFinite(perDoseRaw) && perDoseRaw > 0 ? perDoseRaw : 1
  const refilledMs = new Date(refilledAt).getTime()

  let used = 0
  for (const dose of doses) {
    if (new Date(dose.occurred_at).getTime() < refilledMs) continue
    const doseUsed = Number((dose.details as Record<string, unknown>).supply_used)
    used += Number.isFinite(doseUsed) && doseUsed >= 0 ? doseUsed : perDose
  }

  // Round away float noise from fractional doses (e.g. 0.1 ml)
  const remaining = Math.max(0, Math.round((quantity - used) * 100) / 100)

  const thresholdRaw = Number(d.supply_low_threshold)
  const lowThreshold = d.supply_low_threshold != null && Number.isFinite(thresholdRaw)
    ? thresholdRaw
    : Math.ceil(quantity * DEFAULT_LOW_SUPPLY_FRACTION)

  const frequency     = d.frequency as MedicationFrequency | undefined
  const intervalHours = frequency ? FREQUENCY_HOURS[frequency] : null
  const dailyUse      = intervalHours ? (24 / intervalHours) * perDose : null

  return {
    unit:     (d.supply_unit as string) || 'doses',
    quantity,
    startedAt: refilledAt,
    perDose,
    remaining,
    lowThreshold,
    isEmpty:  remaining <= 0,
    isLow:    remaining <= lowThreshold,
    daysLeft: dailyUse ? Math.floor(remaining / dailyUse) : null,
  }
}

/** e.g. "42 puffs left · ~21 days" */
export function formatSupplyLabel(supply: MedicationSupply): string {
  if (supply.isEmpty) return `Out of ${supply.unit}`
  const days = supply.daysLeft === null
    ? ''
    : ` · ~${supply.daysLeft} day${supply.daysLeft === 1 ? '' : 's'}`
  return `${supply.remaining} ${supply.unit} left${days}`
}

export type DoseTimelineRow =
  | { type: 'dose'; event: CareEvent }
  | { type: 'missed'; expectedAt: string }

/**
 * Builds a unified dose timeline for a single medication.
 * Inserts "missed" rows wherever a dose gap exceeds the expected interval.
 * startAt is the occurred_at of the "start" event (active_medication: true).
 * doses should be sorted newest-first on entry; output is also newest-first.
 * endAtMs caps a finite course: no expected slots (so no "missed" rows) after it.
 */
export function buildDoseTimeline(
  frequency: MedicationFrequency | null | undefined,
  startAt: string,
  doses: CareEvent[],
  endAtMs: number | null = null,
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

  const horizon = endAtMs === null ? now + intervalMs : Math.min(endAtMs, now + intervalMs)

  while (expectedMs <= horizon) {
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
  track_toothbrushing: boolean
}

export interface CatTodayStatus {
  feedCount: number
  feedingsNeeded: number
  lastFedAt: string | null
  lastFedBy: string | null
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
    trackToothbrushing:  requirements?.track_toothbrushing ?? false,
    toothbrushingDoneAt: lastToothbrushing?.occurred_at ?? null,
    recentSymptomAt:     lastSymptom?.occurred_at ?? null,
    medicationTasks:     allMedEvents ? getActiveMedicationTasks(catId, allMedEvents) : [],
  }
}

// ─── Household Chore Helpers ──────────────────────────────────────────────────

/** Returns a map of chore_definition_id → count of times done today. */
export function getChoreDailyCountMap(
  chores: HouseholdChore[],
  definitions: HouseholdChoreDefinition[],
): Map<number, number> {
  const todayChores = chores.filter(c => isToday(c.occurred_at))
  return new Map(
    definitions.map((def) => [
      def.id,
      todayChores.filter(c => c.chore_definition_id === def.id).length,
    ])
  )
}

/** True when every active definition has been done at least frequency_per_day times today. */
export function areAllChoresDone(
  chores: HouseholdChore[],
  definitions: HouseholdChoreDefinition[],
): boolean {
  const active = definitions.filter(d => d.active)
  if (active.length === 0) return true
  const countMap = getChoreDailyCountMap(chores, active)
  return active.every(d => (countMap.get(d.id) ?? 0) >= d.frequency_per_day)
}
