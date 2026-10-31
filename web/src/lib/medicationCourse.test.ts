import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CareEvent } from '@/types/api'
import {
  buildDoseTimeline, getActiveMedicationTasks, getCourseEndMs, isMedicationCourseOver,
} from './helpers'

const NOW = new Date(2026, 9, 31, 12, 0, 0) // 31 Oct 2026, local noon

function ev(id: number, occurredAt: Date, details: Record<string, unknown>): CareEvent {
  return {
    id, cat_id: 1, event_type: 'medication', occurred_at: occurredAt.toISOString(), details,
  } as unknown as CareEvent
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
afterEach(() => vi.useRealTimers())

describe('finite medication course', () => {
  const start = new Date(2026, 5, 1, 8, 0) // 1 Jun
  const startDetails = {
    medication_name: 'Amox', active_medication: true, frequency: 'once_daily', course_end_date: '2026-06-07',
  }
  const startEvent = ev(1, start, startDetails)

  it('is over only after the end date', () => {
    expect(isMedicationCourseOver(startDetails)).toBe(true)
    expect(isMedicationCourseOver({ course_end_date: '2026-10-31' })).toBe(false) // last day
    expect(isMedicationCourseOver({})).toBe(false)
  })

  it('creates no missed rows after the course end, even when no dose was logged', () => {
    const rows = buildDoseTimeline('once_daily', startEvent.occurred_at, [], getCourseEndMs(startDetails))
    const lastSlot = new Date(2026, 5, 7, 23, 59, 59, 999).getTime()
    expect(rows.length).toBeLessThanOrEqual(7)
    for (const r of rows) {
      if (r.type === 'missed') expect(new Date(r.expectedAt).getTime()).toBeLessThanOrEqual(lastSlot)
    }
  })

  it('still produces open-ended missed rows when there is no end date', () => {
    const rows = buildDoseTimeline('once_daily', start.toISOString(), [], null)
    expect(rows.filter(r => r.type === 'missed').length).toBeGreaterThan(100)
  })

  it('stays finite when all doses are logged and none are expected afterwards', () => {
    const doses = Array.from({ length: 6 }, (_, i) => ev(10 + i, new Date(2026, 5, 2 + i, 8, 0), { medication_name: 'Amox' }))
    const rows = buildDoseTimeline('once_daily', start.toISOString(), doses, getCourseEndMs(startDetails))
    expect(rows.filter(r => r.type === 'missed')).toHaveLength(0)
    expect(rows.filter(r => r.type === 'dose')).toHaveLength(6)
  })

  it('creates no dashboard task for an expired course', () => {
    expect(getActiveMedicationTasks(1, [startEvent])).toEqual([])
  })
})
