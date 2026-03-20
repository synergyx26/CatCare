import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  backTo?: { label: string; onClick: () => void }
}

export function PageHeader({ title, subtitle, action, backTo }: PageHeaderProps) {
  return (
    <div className="mb-6 space-y-1">
      {backTo && (
        <button
          onClick={backTo.onClick}
          className="text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
        >
          &larr; {backTo.label}
        </button>
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
