import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChartId } from '@/lib/chartLayout'

export const ALL_CHART_IDS: ChartId[] = [
  'weight',
  'feeding',
  'care_breakdown',
  'member',
  'heatmap',
  'food_intake',
  'symptom_log',
  'calendar',
]

/**
 * Ensures the stored order contains exactly the current set of chart IDs.
 * Preserves the user's saved order but appends any newly-added chart IDs
 * and removes any that no longer exist.
 */
export function normalizeChartOrder(saved: ChartId[]): ChartId[] {
  const known = new Set<ChartId>(ALL_CHART_IDS)
  const seen = new Set<ChartId>()
  const result: ChartId[] = []
  for (const id of saved) {
    if (known.has(id) && !seen.has(id)) {
      result.push(id)
      seen.add(id)
    }
  }
  for (const id of ALL_CHART_IDS) {
    if (!seen.has(id)) result.push(id)
  }
  return result
}

interface ChartPrefsState {
  /** Chart IDs the user has explicitly hidden. */
  hidden: ChartId[]
  /** Full ordered list of all chart IDs (user-preferred sequence). */
  order: ChartId[]
  toggleChart: (id: ChartId) => void
  setOrder: (order: ChartId[]) => void
  reset: () => void
}

export const useChartPrefsStore = create<ChartPrefsState>()(
  persist(
    (set) => ({
      hidden: [],
      order: ALL_CHART_IDS,

      toggleChart: (id) =>
        set((s) => ({
          hidden: s.hidden.includes(id)
            ? s.hidden.filter((h) => h !== id)
            : [...s.hidden, id],
        })),

      setOrder: (order) => set({ order }),

      reset: () => set({ hidden: [], order: ALL_CHART_IDS }),
    }),
    { name: 'catcare_chart_prefs' }
  )
)
