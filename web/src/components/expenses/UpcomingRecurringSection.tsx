import { Clock, Pencil, Trash2 } from 'lucide-react'
import { EXPENSE_CATEGORY_ICONS, EXPENSE_CATEGORY_LABELS } from '@/types/api'
import type { PetExpense, Cat } from '@/types/api'
import { formatCurrency } from '@/lib/currency'

interface Props {
  upcoming: PetExpense[]
  cats: Cat[]
  onEdit: (expense: PetExpense) => void
  onDelete: (expense: PetExpense) => void
  canWrite: boolean
  currency: string
}

function daysUntilDue(expense: PetExpense): number {
  if (!expense.recurrence_interval_days) return 0
  const last = new Date(expense.purchase_date)
  const due = new Date(last)
  due.setDate(due.getDate() + expense.recurrence_interval_days)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function dueBadge(days: number) {
  if (days <= 0) return { label: 'Due today', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
  if (days === 1) return { label: 'Due tomorrow', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' }
  if (days <= 3) return { label: `Due in ${days} days`, cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' }
  return { label: `Due in ${days} days`, cls: 'bg-muted text-muted-foreground' }
}

export function UpcomingRecurringSection({ upcoming, cats, onEdit, onDelete, canWrite, currency }: Props) {
  const catName = (id: number | null) =>
    id == null ? 'Household' : (cats.find((c) => c.id === id)?.name ?? 'Unknown')

  const items = upcoming
    .map((e) => ({ expense: e, days: daysUntilDue(e) }))
    .sort((a, b) => a.days - b.days)

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
        <Clock className="size-4 text-violet-500" />
        <h3 className="text-sm font-semibold">Upcoming Recurring</h3>
        <span className="ml-auto text-xs text-muted-foreground">Due within 14 days</span>
      </div>

      <div className="divide-y divide-border/40">
        {items.map(({ expense: e, days }) => {
          const badge = dueBadge(days)
          return (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              {/* Icon */}
              <div className="shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-lg">
                {EXPENSE_CATEGORY_ICONS[e.category]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{e.product_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
                  <span>{EXPENSE_CATEGORY_LABELS[e.category]}</span>
                  <span>{catName(e.cat_id)}</span>
                  <span>{formatCurrency(e.total_cost, currency)}</span>
                </div>
              </div>

              {/* Due badge */}
              <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                {badge.label}
              </span>

              {/* Actions */}
              {canWrite && (
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(e)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Edit"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(e)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
