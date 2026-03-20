import type { ResponsiveLayouts } from 'react-grid-layout'

export type ChartId = 'weight' | 'feeding' | 'care_breakdown' | 'member' | 'heatmap'

// 12-column grid, rowHeight=60px, margin=16px
// Effective card height = h*60 + (h-1)*16
// minH:4 → 288px, minH:5 → 364px
// lg breakpoint (≥768px): 2-col layout for side-by-side cards
// sm breakpoint (<768px): all cards full-width
export const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: 'weight',         x: 0, y: 0,  w: 12, h: 5, minW: 5, minH: 4 },
    { i: 'feeding',        x: 0, y: 5,  w: 6,  h: 5, minW: 5, minH: 4 },
    { i: 'care_breakdown', x: 6, y: 5,  w: 6,  h: 5, minW: 5, minH: 4 },
    { i: 'member',         x: 0, y: 10, w: 12, h: 4, minW: 5, minH: 3 },
    { i: 'heatmap',        x: 0, y: 14, w: 12, h: 7, minW: 8, minH: 5 },
  ],
  sm: [
    { i: 'weight',         x: 0, y: 0,  w: 12, h: 5, minW: 12, minH: 4 },
    { i: 'feeding',        x: 0, y: 5,  w: 12, h: 5, minW: 12, minH: 4 },
    { i: 'care_breakdown', x: 0, y: 10, w: 12, h: 5, minW: 12, minH: 4 },
    { i: 'member',         x: 0, y: 15, w: 12, h: 4, minW: 12, minH: 3 },
    { i: 'heatmap',        x: 0, y: 19, w: 12, h: 7, minW: 12, minH: 5 },
  ],
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
