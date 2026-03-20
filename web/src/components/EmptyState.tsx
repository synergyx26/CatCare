import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-sky-200 dark:border-sky-800/40 bg-sky-50/50 dark:bg-sky-950/10 p-8 text-center space-y-3">
      <div className="flex justify-center">
        <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
          <Icon className="size-6 text-sky-500 dark:text-sky-400" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex h-9 items-center justify-center rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 px-4 text-sm font-semibold text-white transition-colors cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
