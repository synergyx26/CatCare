import type { EventType } from '@/types/api'

export interface BatchAction {
  id: string
  label: string
  event_type: EventType
  details: Record<string, unknown>
}

const storageKey = (householdId: number) => `catcare_batch_actions_${householdId}`

export function loadBatchActions(householdId: number): BatchAction[] {
  try {
    const raw = localStorage.getItem(storageKey(householdId))
    return raw ? (JSON.parse(raw) as BatchAction[]) : []
  } catch {
    return []
  }
}

export function saveBatchActions(householdId: number, actions: BatchAction[]): void {
  localStorage.setItem(storageKey(householdId), JSON.stringify(actions))
}
