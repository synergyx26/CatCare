import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-8 text-center space-y-3">
      <div className="flex justify-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="size-6 text-primary" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex h-9 items-center justify-center rounded-xl bg-primary hover:bg-primary/90 active:bg-primary/80 px-4 text-sm font-semibold text-primary-foreground transition-colors cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
