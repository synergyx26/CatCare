import type { CareEvent, EventType } from '@/types/api'

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
}

export function getCatTodayStatus(
  catId: number,
  todayEvents: CareEvent[],
  memberMap: Map<number, string>,
  currentUserId: number,
  requirements?: CatCareRequirements
): CatTodayStatus {
  const catEvents = todayEvents.filter((e) => e.cat_id === catId)

  const feedings = catEvents
    .filter((e) => e.event_type === 'feeding')
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
  }
}
