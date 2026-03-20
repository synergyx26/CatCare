import type { CareEvent, EventType } from '@/types/api'

export function isToday(isoString: string): boolean {
  const d = new Date(isoString)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
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
    case 'note':
      return 'Note'
    default:
      return event.event_type
  }
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  feeding: 'Feeding',
  litter: 'Litter',
  water: 'Water',
  weight: 'Weight',
  note: 'Note',
  medication: 'Medication',
  vet_visit: 'Vet visit',
  grooming: 'Grooming',
}

export interface CatTodayStatus {
  feedCount: number
  lastFedAt: string | null
  lastFedBy: string | null
  litterDoneAt: string | null
  waterDoneAt: string | null
}

export function getCatTodayStatus(
  catId: number,
  todayEvents: CareEvent[],
  memberMap: Map<number, string>,
  currentUserId: number
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

  const lastFeeding = feedings[0]
  let lastFedBy: string | null = null
  if (lastFeeding) {
    const name = memberMap.get(lastFeeding.logged_by_id)
    lastFedBy =
      lastFeeding.logged_by_id === currentUserId ? 'You' : (name ?? 'Someone')
  }

  return {
    feedCount: feedings.length,
    lastFedAt: lastFeeding?.occurred_at ?? null,
    lastFedBy,
    litterDoneAt: lastLitter?.occurred_at ?? null,
    waterDoneAt: lastWater?.occurred_at ?? null,
  }
}
