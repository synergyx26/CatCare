import type { CareNoteCategory } from '@/types/api'

export const CARE_NOTE_CATEGORIES: CareNoteCategory[] = [
  'feeding', 'litter', 'supplies', 'home', 'medical', 'general',
]

export const CARE_NOTE_CATEGORY_LABELS: Record<CareNoteCategory, string> = {
  feeding:  'Feeding',
  litter:   'Litter',
  supplies: 'Supplies',
  home:     'Home',
  medical:  'Medical',
  general:  'General',
}

// Colors aligned with EVENT_COLORS in lib/eventColors.ts for visual continuity
export const CARE_NOTE_CATEGORY_COLORS: Record<CareNoteCategory, string> = {
  feeding:  '#f59e0b',  // amber  — matches EVENT_COLORS.feeding
  litter:   '#a855f7',  // purple — matches EVENT_COLORS.litter
  supplies: '#64748b',  // slate
  home:     '#0ea5e9',  // sky
  medical:  '#ef4444',  // red    — matches EVENT_COLORS.medication
  general:  '#94a3b8',  // muted  — matches EVENT_COLORS.note
}
