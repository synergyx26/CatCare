import type { ResponsiveLayouts } from 'react-grid-layout'

export type ChartId = 'weight' | 'feeding' | 'care_breakdown' | 'member' | 'heatmap' | 'food_intake' | 'symptom_log' | 'calendar'

// 12-column grid, rowHeight=60px, margin=16px
// Effective card height = h*60 + (h-1)*16
// minH:4 → 288px, minH:5 → 364px, minH:6 → 440px
// lg breakpoint (≥768px): 2-col layout for side-by-side cards
// sm breakpoint (<768px): all cards full-width
export const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: 'weight',         x: 0, y: 0,  w: 6,  h: 5, minW: 5, minH: 4 },
    { i: 'feeding',        x: 6, y: 0,  w: 6,  h: 5, minW: 5, minH: 4 },
    { i: 'care_breakdown', x: 0, y: 5,  w: 6,  h: 5, minW: 5, minH: 4 },
    { i: 'member',         x: 6, y: 5,  w: 6,  h: 5, minW: 5, minH: 3 },
    { i: 'heatmap',        x: 0, y: 10, w: 12, h: 7, minW: 8, minH: 5 },
    { i: 'food_intake',    x: 0, y: 17, w: 12, h: 6, minW: 8, minH: 5 },
    { i: 'symptom_log',    x: 0, y: 23, w: 12, h: 6, minW: 8, minH: 5 },
    { i: 'calendar',       x: 0, y: 29, w: 12, h: 9, minW: 8, minH: 7 },
  ],
  sm: [
    { i: 'weight',         x: 0, y: 0,  w: 12, h: 5, minW: 12, minH: 4 },
    { i: 'feeding',        x: 0, y: 5,  w: 12, h: 5, minW: 12, minH: 4 },
    { i: 'care_breakdown', x: 0, y: 10, w: 12, h: 5, minW: 12, minH: 4 },
    { i: 'member',         x: 0, y: 15, w: 12, h: 4, minW: 12, minH: 3 },
    { i: 'heatmap',        x: 0, y: 19, w: 12, h: 7, minW: 12, minH: 5 },
    { i: 'food_intake',    x: 0, y: 26, w: 12, h: 6, minW: 12, minH: 5 },
    { i: 'symptom_log',    x: 0, y: 32, w: 12, h: 6, minW: 12, minH: 5 },
    { i: 'calendar',       x: 0, y: 38, w: 12, h: 10, minW: 12, minH: 7 },
  ],
}

/**
 * Build a fresh ResponsiveLayouts from an ordered list of chart IDs.
 * Used to sync the grid positions whenever the user reorders charts in the
 * settings panel. Half-width charts (w=6) are paired side-by-side in lg;
 * all charts stack full-width in sm.
 */
export function buildLayoutFromOrder(orderedIds: ChartId[]): ResponsiveLayouts {
  type Item = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number }

  const lgMap = new Map<string, Item>(
    (DEFAULT_LAYOUTS.lg ?? []).map(item => [item.i, item as Item])
  )
  const smMap = new Map<string, Item>(
    (DEFAULT_LAYOUTS.sm ?? []).map(item => [item.i, item as Item])
  )

  // sm: all full-width stacked in order
  let smY = 0
  const sm = orderedIds.map(id => {
    const d = smMap.get(id) ?? { i: id, x: 0, y: 0, w: 12, h: 5, minW: 12, minH: 4 }
    const item: Item = { i: id, x: 0, y: smY, w: 12, h: d.h, minW: 12, minH: d.minH ?? 4 }
    smY += d.h + 1
    return item
  })

  // lg: pair consecutive half-width (w=6) charts side by side; others standalone
  const lg: Item[] = []
  let lgY = 0
  let idx = 0
  while (idx < orderedIds.length) {
    const id = orderedIds[idx]
    const d = lgMap.get(id) ?? { i: id, x: 0, y: 0, w: 12, h: 5, minW: 8, minH: 4 }

    if (d.w === 6 && idx + 1 < orderedIds.length) {
      const nextId = orderedIds[idx + 1]
      const dn = lgMap.get(nextId) ?? { i: nextId, x: 6, y: 0, w: 12, h: 5, minW: 8, minH: 4 }
      if (dn.w === 6) {
        // Pair them at the same row
        lg.push({ i: id,     x: 0, y: lgY, w: 6, h: d.h,  minW: d.minW,  minH: d.minH  })
        lg.push({ i: nextId, x: 6, y: lgY, w: 6, h: dn.h, minW: dn.minW, minH: dn.minH })
        lgY += Math.max(d.h, dn.h) + 1
        idx += 2
        continue
      }
    }

    // Standalone row (full-width or unpaired half-width)
    lg.push({ i: id, x: 0, y: lgY, w: d.w, h: d.h, minW: d.minW, minH: d.minH })
    lgY += d.h + 1
    idx++
  }

  return { lg, sm }
}

const STORAGE_KEY = (catId: string | number) => `catcare_chart_layout_${catId}`

export function loadLayouts(catId: string | number): ResponsiveLayouts | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(catId))
    return raw ? (JSON.parse(raw) as ResponsiveLayouts) : null
  } catch {
    return null
  }
}

export function saveLayouts(catId: string | number, layouts: ResponsiveLayouts): void {
  try {
    localStorage.setItem(STORAGE_KEY(catId), JSON.stringify(layouts))
  } catch {
    // Ignore quota errors
  }
}

export function clearLayouts(catId: string | number): void {
  try {
    localStorage.removeItem(STORAGE_KEY(catId))
  } catch {
    // Ignore
  }
}
