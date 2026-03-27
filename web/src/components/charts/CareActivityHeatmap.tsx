import { useState, useRef, useEffect } from 'react'
import type { DayStats } from '@/types/api'

// Unambiguous 2-char abbreviations so 'S' and 'T' don't appear twice
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const GAP      = 4   // px between cells
const OVERHEAD = 48  // px for weekday header + legend row + their gaps
const MIN_CELL = 10  // never go below this — keeps 90d readable

// Uses sky-500 (rgb 14 165 233) at varying opacity — visible on both light and
// dark backgrounds without needing theme detection.
function heatColor(count: number, max: number): string {
  if (count === 0) return 'var(--color-muted)'
  const t = count / max
  if (t < 0.25) return 'rgba(14, 165, 233, 0.38)'
  if (t < 0.5)  return 'rgba(14, 165, 233, 0.60)'
  if (t < 0.75) return 'rgba(14, 165, 233, 0.82)'
  return '#0ea5e9'  // sky-500 full
}

const LEGEND_SWATCHES = [
  'var(--color-muted)',
  'rgba(14, 165, 233, 0.38)',
  'rgba(14, 165, 233, 0.60)',
  'rgba(14, 165, 233, 0.82)',
  '#0ea5e9',
]

interface Props {
  data: DayStats[]
}

export function CareActivityHeatmap({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize] = useState(14)

  const firstDow = data.length ? new Date(data[0].date + 'T12:00:00').getDay() : 0
  const cells: (DayStats | null)[] = [...Array(firstDow).fill(null), ...data]
  const numWeeks = Math.ceil(cells.length / 7)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function compute(width: number, height: number) {
      const byHeight = Math.floor((height - OVERHEAD - (numWeeks - 1) * GAP) / numWeeks)
      const byWidth  = Math.floor((width  - 6 * GAP) / 7)
      // No upper cap — cells grow to fill available space as days decrease.
      // byWidth is the practical limit on wide containers; byHeight on tall ones.
      setCellSize(Math.max(MIN_CELL, Math.min(byHeight, byWidth)))
    }

    // Recompute immediately — fires when numWeeks changes (range switch) even if
    // container dimensions haven't changed, so the observer alone wouldn't fire.
    const { width, height } = el.getBoundingClientRect()
    compute(width, height)

    const observer = new ResizeObserver(([entry]) => {
      compute(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [numWeeks])

  if (!data.length) return null

  const maxCount  = Math.max(...data.map((d) => d.count), 1)
  const gridWidth = 7 * cellSize + 6 * GAP
  // Scale label text with cell size: 10px at small cells, up to 14px for large
  const labelSize = Math.max(10, Math.min(14, Math.round(cellSize * 0.3)))

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center gap-[4px] h-full overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 shrink-0" style={{ width: gridWidth, gap: GAP }}>
        {WEEKDAY_LABELS.map((d, i) => (
          <div
            key={i}
            className="text-center text-muted-foreground font-medium"
            style={{ width: cellSize, fontSize: labelSize }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 shrink-0" style={{ width: gridWidth, gap: GAP }}>
        {cells.map((cell, i) =>
          cell ? (
            <div
              key={i}
              className="rounded-[3px] cursor-default transition-opacity hover:opacity-80"
              style={{ width: cellSize, height: cellSize, backgroundColor: heatColor(cell.count, maxCount) }}
              title={`${new Date(cell.date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              })}: ${cell.count} event${cell.count !== 1 ? 's' : ''}`}
            />
          ) : (
            <div key={i} style={{ width: cellSize, height: cellSize }} />
          )
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
        <span>Less</span>
        {LEGEND_SWATCHES.map((color, i) => (
          <div key={i} className="rounded-[2px]" style={{ width: 12, height: 12, backgroundColor: color }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
