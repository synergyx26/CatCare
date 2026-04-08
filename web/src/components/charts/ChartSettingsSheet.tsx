import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff, SlidersHorizontal, RotateCcw, X, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChartId } from '@/lib/chartLayout'
import { useChartPrefsStore, normalizeChartOrder, ALL_CHART_IDS } from '@/store/chartPrefsStore'

// ─── Chart metadata ───────────────────────────────────────────────────────────

const CHART_META: Record<ChartId, { label: string; description: string; color: string }> = {
  weight:         { label: 'Weight trend',            description: 'Body weight over time',       color: '#34d399' },
  feeding:        { label: 'Feeding frequency',       description: 'Feedings per day',            color: '#fbbf24' },
  care_breakdown: { label: 'Care breakdown',          description: 'Events by type',              color: '#38bdf8' },
  member:         { label: 'Household contributions', description: 'Events logged per member',    color: '#c084fc' },
  heatmap:        { label: 'Activity heatmap',        description: 'Care intensity by day',       color: '#22d3ee' },
  food_intake:    { label: 'Daily food intake',       description: 'Grams per food type',         color: '#fb923c' },
  symptom_log:    { label: 'Symptom log',             description: 'Health symptoms over time',   color: '#f97316' },
  calendar:       { label: 'Care calendar',           description: 'Monthly event view',          color: '#818cf8' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChartSettingsSheet() {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)

  const { hidden, order, toggleChart, setOrder, reset } = useChartPrefsStore()

  // ── Save confirmation indicator ───────────────────────────────────────────
  const isMountedRef = useRef(false)
  const [showSaved, setShowSaved] = useState(false)

  // Skip the first render (initial store values), then show "Saved" on any change
  useLayoutEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true
      return
    }
    setShowSaved(true)
    const t = setTimeout(() => setShowSaved(false), 2000)
    return () => clearTimeout(t)
  }, [order, hidden])

  // Local drag state — preview order during drag, commit to store on drop
  const [dragOrder, setDragOrder] = useState<ChartId[] | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIndicator, setDropIndicator] = useState<number | null>(null)

  const normalizedOrder = normalizeChartOrder(order)
  // During drag, show the locally-reordered list for live preview
  const currentOrder = dragOrder ?? normalizedOrder
  const hiddenSet = new Set(hidden)
  const visibleCount = ALL_CHART_IDS.length - hidden.length

  // ── Open / close ─────────────────────────────────────────────────────────

  const handleOpen = useCallback(() => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      // Anchor panel below the trigger button, aligned to its right edge
      setPanelStyle({
        top: r.bottom + 8,
        right: Math.max(8, window.innerWidth - r.right),
      })
    }
    setOpen(true)
  }, [])

  // Escape key closes panel
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Reset local drag state when panel closes
  useEffect(() => {
    if (!open) {
      setDragOrder(null)
      setDragIdx(null)
      setDropIndicator(null)
    }
  }, [open])

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    e.dataTransfer.effectAllowed = 'move'
    // Needed for Firefox
    e.dataTransfer.setData('text/plain', String(idx))
    setDragIdx(idx)
    setDragOrder(currentOrder)
  }, [currentOrder])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropIndicator(idx)

    if (dragIdx === null || dragIdx === idx) return
    setDragOrder((prev) => {
      const list = [...(prev ?? normalizedOrder)]
      const [item] = list.splice(dragIdx, 1)
      list.splice(idx, 0, item)
      return list
    })
    setDragIdx(idx)
  }, [dragIdx, normalizedOrder])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (dragOrder) setOrder(dragOrder)
    setDragIdx(null)
    setDropIndicator(null)
    setDragOrder(null)
  }, [dragOrder, setOrder])

  const handleDragEnd = useCallback(() => {
    // If drop didn't fire (e.g. dropped outside), restore original order
    if (dragOrder) setOrder(dragOrder)
    setDragIdx(null)
    setDropIndicator(null)
    setDragOrder(null)
  }, [dragOrder, setOrder])

  // ─────────────────────────────────────────────────────────────────────────

  const panel = open ? (
    <>
      {/* Transparent click-outside catcher */}
      <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

      {/* Floating panel — rendered with no backdrop so charts update visibly */}
      <div
        className="fixed z-50 w-72 flex flex-col bg-background border border-border/70 rounded-2xl shadow-2xl overflow-hidden"
        style={{ ...panelStyle, maxHeight: 'calc(100dvh - 120px)' }}
        // Prevent clicks inside the panel from closing it via the outside catcher
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-border/60 shrink-0">
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">Customise charts</p>
            <p className="text-xs mt-0.5 flex items-center gap-1.5 transition-colors">
              {showSaved ? (
                <span className="text-emerald-500 font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Saved
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {visibleCount} of {ALL_CHART_IDS.length} shown · drag to reorder
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/60 transition-colors -mt-0.5 -mr-0.5 shrink-0"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Draggable chart list */}
        <ul
          className="flex-1 overflow-y-auto divide-y divide-border/40"
          onDragOver={(e) => e.preventDefault()}
        >
          {currentOrder.map((id, idx) => {
            const meta = CHART_META[id]
            const isHidden = hiddenSet.has(id)
            const isBeingDragged = dragIdx === idx
            const isDropTarget = dropIndicator === idx && dragIdx !== null && dragIdx !== idx

            return (
              <li
                key={id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                className={[
                  'flex items-center gap-2.5 px-3 py-3 select-none transition-all duration-100',
                  isBeingDragged ? 'opacity-30 bg-muted/30' : 'hover:bg-muted/20',
                  isDropTarget ? 'border-t-2 border-primary' : '',
                  isHidden ? 'opacity-50' : '',
                ].join(' ')}
              >
                {/* Drag handle */}
                <GripVertical className="size-4 text-muted-foreground/40 cursor-grab active:cursor-grabbing shrink-0" />

                {/* Accent colour dot */}
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: meta.color }}
                />

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <p className={[
                    'text-sm font-medium leading-tight',
                    isHidden ? 'line-through text-muted-foreground' : 'text-foreground',
                  ].join(' ')}>
                    {meta.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {meta.description}
                  </p>
                </div>

                {/* Visibility toggle */}
                <button
                  onClick={() => toggleChart(id)}
                  aria-label={isHidden ? `Show ${meta.label}` : `Hide ${meta.label}`}
                  aria-pressed={!isHidden}
                  className={[
                    'flex items-center justify-center w-7 h-7 rounded-lg transition-colors shrink-0',
                    isHidden
                      ? 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50'
                      : 'text-sky-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30',
                  ].join(' ')}
                >
                  {isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </li>
            )
          })}
        </ul>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-border/60 space-y-2 shrink-0">
          <p className="text-[11px] text-muted-foreground leading-snug">
            On desktop, drag chart cards directly in the grid to reposition them independently.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs"
            onClick={reset}
          >
            <RotateCcw className="size-3" />
            Reset to defaults
          </Button>
        </div>
      </div>
    </>
  ) : null

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className={[
          'flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl ring-1 ring-border/60 bg-card hover:bg-muted/50 transition-colors',
          open
            ? 'text-primary ring-primary/40 bg-primary/5'
            : 'text-muted-foreground hover:text-foreground',
        ].join(' ')}
        title="Customise which charts are shown and their order"
      >
        <SlidersHorizontal className="size-3.5" />
        <span className="hidden sm:inline">Charts</span>
      </button>

      {typeof document !== 'undefined' && createPortal(panel, document.body)}
    </>
  )
}
