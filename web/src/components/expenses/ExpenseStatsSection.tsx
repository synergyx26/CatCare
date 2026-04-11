import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_ICONS } from '@/types/api'
import type { ExpenseStats, ExpenseRange, Cat, ExpenseCategory } from '@/types/api'
import { formatCurrency } from '@/lib/currency'
import { ExpenseCategoryDonutChart } from '@/components/charts/ExpenseCategoryDonutChart'
import { ExpenseTrendChart } from '@/components/charts/ExpenseTrendChart'
import { ExpenseByCatChart } from '@/components/charts/ExpenseByCatChart'

const RANGES: { value: ExpenseRange; label: string }[] = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
]

interface Props {
  range: ExpenseRange
  setRange: (r: ExpenseRange) => void
  stats: ExpenseStats | undefined
  isLoading: boolean
  cats: Cat[]
  currency: string
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

export function ExpenseStatsSection({ range, setRange, stats, isLoading, cats, currency }: Props) {
  const total = stats?.total ?? 0

  // Top category
  const topCategory = stats
    ? (Object.entries(stats.by_category).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))[0] ?? null)
    : null

  // Recurring count (from upcoming — count distinct recurring expenses overall)
  const recurringCount = stats?.upcoming?.length ?? 0

  // This month value
  const thisMonthKey = new Date().toISOString().slice(0, 7)
  const thisMonth = stats?.by_month?.[thisMonthKey] ?? 0

  // Show by-cat chart only if 2+ entries (i.e. 2+ cats have data, or 1 cat + household)
  const catEntries = Object.entries(stats?.by_cat ?? {}).filter(([, v]) => v > 0)

  return (
    <div className="space-y-4">
      {/* Range picker */}
      <div className="flex gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              range === r.value
                ? 'bg-violet-600 text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Spent"
          value={isLoading ? '—' : formatCurrency(total, currency)}
          sub={range === 'all' ? 'all time' : `last ${range}`}
        />
        <StatCard
          label="This Month"
          value={isLoading ? '—' : formatCurrency(thisMonth, currency)}
        />
        <StatCard
          label="Recurring"
          value={isLoading ? '—' : String(recurringCount)}
          sub="due in 14 days"
        />
        <StatCard
          label="Top Category"
          value={
            isLoading || !topCategory
              ? '—'
              : `${EXPENSE_CATEGORY_ICONS[topCategory[0] as ExpenseCategory]} ${EXPENSE_CATEGORY_LABELS[topCategory[0] as ExpenseCategory]}`
          }
          sub={topCategory ? formatCurrency(topCategory[1] as number, currency) : undefined}
        />
      </div>

      {/* Charts — only shown when there's data */}
      {!isLoading && total > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ExpenseCategoryDonutChart data={stats!.by_category} total={total} currency={currency} />
            {Object.keys(stats!.by_month).length > 0 && (
              <ExpenseTrendChart data={stats!.by_month} currency={currency} />
            )}
          </div>
          {catEntries.length >= 2 && (
            <ExpenseByCatChart data={stats!.by_cat} cats={cats} currency={currency} />
          )}
        </>
      )}
    </div>
  )
}
