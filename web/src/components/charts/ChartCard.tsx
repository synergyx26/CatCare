import { forwardRef } from 'react'
import type { ReactNode, HTMLAttributes } from 'react'
import { GripVertical } from 'lucide-react'

interface ChartCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  subtitle?: string
  /** CSS gradient string, e.g. "linear-gradient(to right, #34d399, #4ade80)" */
  accent?: string
  children: ReactNode
}

export const ChartCard = forwardRef<HTMLDivElement, ChartCardProps>(
  ({ title, subtitle, accent, children, className, style, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        style={style}
        className={[
          'rounded-2xl bg-card ring-1 ring-border/60 shadow-sm flex flex-col overflow-hidden',
          className ?? '',
        ].join(' ')}
        {...rest}
      >
        {accent && (
          <div className="h-[3px] w-full shrink-0" style={{ background: accent }} />
        )}
        {/* Header row: title + drag handle */}
        <div className="flex items-start justify-between px-5 pt-4 pb-1 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div
            className="drag-handle cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors mt-0.5 -mr-1 ml-2 shrink-0"
            title="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </div>
        </div>
        {/* Chart area: absolute inner gives ResponsiveContainer a concrete pixel box it can shrink into */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <div className="absolute inset-0 px-2 pb-4 pt-1">
            {children}
          </div>
        </div>
      </div>
    )
  }
)
ChartCard.displayName = 'ChartCard'
