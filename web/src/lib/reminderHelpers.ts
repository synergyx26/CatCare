import type { Reminder, ReminderScheduleType } from '@/types/api'

export interface ScheduleTypeOption {
  value: ReminderScheduleType
  label: string
  hint: string
}

export const SCHEDULE_TYPE_OPTIONS: ScheduleTypeOption[] = [
  { value: 'daily',    label: 'Daily',         hint: 'e.g. every day at 8:00 AM' },
  { value: 'interval', label: 'Every N hours',  hint: 'e.g. every 12 hours' },
  { value: 'weekly',   label: 'Weekly',         hint: 'e.g. every Monday' },
]

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

/** Returns a human-readable description of a reminder's schedule. */
export function formatSchedule(reminder: Reminder): string {
  const v = reminder.schedule_value

  switch (reminder.schedule_type) {
    case 'daily': {
      if (!v) return 'Daily'
      // v = "HH:MM" in 24-hour format
      const [h, m] = v.split(':').map(Number)
      if (isNaN(h) || isNaN(m)) return 'Daily'
      const d = new Date()
      d.setHours(h, m, 0, 0)
      return `Daily at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    }
    case 'interval': {
      if (!v) return 'Every N hours'
      const hours = parseInt(v, 10)
      if (isNaN(hours)) return 'Recurring'
      return hours === 1 ? 'Every hour' : `Every ${hours} hours`
    }
    case 'weekly': {
      if (!v) return 'Weekly'
      // v = "monday" or "monday:09:00"
      const [day, time] = v.split(':')
      const dayLabel = DAY_LABELS[day.toLowerCase()] ?? day
      if (!time) return `Weekly on ${dayLabel}s`
      const [h, mi] = time.split(':').map(Number)
      if (isNaN(h) || isNaN(mi)) return `Weekly on ${dayLabel}s`
      const d = new Date()
      d.setHours(h, mi, 0, 0)
      return `${dayLabel}s at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    }
  }
}
