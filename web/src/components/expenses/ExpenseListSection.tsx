import { useState, useEffect } from 'react'
import { Download, ChevronUp, ChevronDown, ChevronsUpDown, MoreHorizontal, Pencil, Trash2, List, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/EmptyState'
import {
  EXPENSE_CATEGORY_ICONS,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
} from '@/types/api'
import type { PetExpense, ExpenseCategory, Cat } from '@/types/api'
import { ReceiptText } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface Props {
  expenses: PetExpense[]
  isLoading: boolean
  cats: Cat[]
  catFilter: number | null
  setCatFilter: (v: number | null) => void
  categoryFilter: string
  setCategoryFilter: (v: string) => void
  dateFrom: string
  setDateFrom: (v: string) => void
  dateTo: string
  setDateTo: (v: string) => void
  onEdit: (expense: PetExpense) => void
  onDelete: (expense: PetExpense) => void
  canWrite: boolean
  currency: string
}

type SortKey = 'purchase_date' | 'product_name' | 'category' | 'total_cost' | 'unit_price' | 'quantity'
type SortDir = 'asc' | 'desc'
type ViewMode = 'table' | 'list'

const STORAGE_KEY = 'catcare_expense_view'

function defaultView(): ViewMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'table' || stored === 'list') return stored
  return window.innerWidth >= 768 ? 'table' : 'list'
}

function exportExpensesCSV(expenses: PetExpense[], cats: Cat[], currency: string) {
  const catName = (id: number | null) =>
    id == null ? 'Household' : (cats.find((c) => c.id === id)?.name ?? 'Unknown')

  const rows = [
    ['Date', 'Product', 'Brand', 'Category', 'Cat', 'Qty', 'Unit', `Unit Price (${currency})`, `Total (${currency})`, 'Store', 'Recurring', 'Interval (days)', 'Notes'],
    ...expenses.map((e) => [
      e.purchase_date,
      e.product_name,
      e.brand ?? '',
      EXPENSE_CATEGORY_LABELS[e.category],
      catName(e.cat_id),
      e.quantity,
      e.unit_label ?? '',
      e.unit_price.toFixed(2),
      e.total_cost.toFixed(2),
      e.store_name ?? '',
      e.is_recurring ? 'Yes' : 'No',
      e.recurrence_interval_days ?? '',
      e.notes ?? '',
    ]),
  ]

  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `catcare-expenses-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="size-3 opacity-40" />
  return sortDir === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
}

const inputCls =
  'rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'

export function ExpenseListSection({
  expenses,
  isLoading,
  cats,
  catFilter,
  setCatFilter,
  categoryFilter,
  setCategoryFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onEdit,
  onDelete,
  canWrite,
  currency,
}: Props) {
  const [view, setView] = useState<ViewMode>(defaultView)
  const [sortKey, setSortKey] = useState<SortKey>('purchase_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, view)
  }, [view])

  function handleSort(col: SortKey) {
    if (col === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(col)
      setSortDir(col === 'purchase_date' || col === 'total_cost' ? 'desc' : 'asc')
    }
  }

  const sorted = [...expenses].sort((a, b) => {
    let av: string | number = a[sortKey] as string | number
    let bv: string | number = b[sortKey] as string | number
    if (typeof av === 'string' && typeof bv === 'string') {
      av = av.toLowerCase()
      bv = bv.toLowerCase()
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const catName = (id: number | null) =>
    id == null ? 'Household' : (cats.find((c) => c.id === id)?.name ?? 'Unknown')

  function thCls(col: SortKey) {
    return `px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap ${
      sortKey === col ? 'text-foreground' : ''
    }`
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="rounded-2xl bg-card ring-1 ring-border/60 px-4 py-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          {/* Cat filter */}
          <div className="flex-1 min-w-[120px]">
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Cat</label>
            <select
              className={`${inputCls} w-full`}
              value={catFilter ?? ''}
              onChange={(e) => setCatFilter(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All cats</option>
              {cats.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div className="flex-1 min-w-[120px]">
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Category</label>
            <select
              className={`${inputCls} w-full`}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {EXPENSE_CATEGORY_ICONS[cat]} {EXPENSE_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="flex-1 min-w-[120px]">
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">From</label>
            <input
              type="date"
              className={`${inputCls} w-full`}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">To</label>
            <input
              type="date"
              className={`${inputCls} w-full`}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {/* Export + view toggle */}
          <div className="flex items-end gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              disabled={expenses.length === 0}
              onClick={() => exportExpensesCSV(expenses, cats, currency)}
            >
              <Download className="size-3.5 mr-1.5" />
              Export
            </Button>

            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setView('list')}
                className={`px-2.5 py-1.5 text-sm transition-colors ${
                  view === 'list' ? 'bg-violet-600 text-white' : 'bg-background text-muted-foreground hover:text-foreground'
                }`}
                aria-label="List view"
              >
                <List className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('table')}
                className={`px-2.5 py-1.5 text-sm transition-colors ${
                  view === 'table' ? 'bg-violet-600 text-white' : 'bg-background text-muted-foreground hover:text-foreground'
                }`}
                aria-label="Table view"
              >
                <Table2 className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Active filter badges */}
        {(catFilter || categoryFilter || dateFrom || dateTo) && (
          <div className="flex flex-wrap gap-1.5">
            {catFilter && (
              <FilterBadge label={catName(catFilter)} onRemove={() => setCatFilter(null)} />
            )}
            {categoryFilter && (
              <FilterBadge
                label={`${EXPENSE_CATEGORY_ICONS[categoryFilter as ExpenseCategory]} ${EXPENSE_CATEGORY_LABELS[categoryFilter as ExpenseCategory]}`}
                onRemove={() => setCategoryFilter('')}
              />
            )}
            {(dateFrom || dateTo) && (
              <FilterBadge
                label={`${dateFrom || '…'} → ${dateTo || '…'}`}
                onRemove={() => { setDateFrom(''); setDateTo('') }}
              />
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No expenses found"
          description="Try adjusting your filters, or add a new expense."
        />
      ) : view === 'table' ? (
        <TableView
          expenses={sorted}
          cats={cats}
          catName={catName}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          thCls={thCls}
          onEdit={onEdit}
          onDelete={onDelete}
          canWrite={canWrite}
          currency={currency}
        />
      ) : (
        <ListView
          expenses={sorted}
          catName={catName}
          onEdit={onEdit}
          onDelete={onDelete}
          canWrite={canWrite}
          currency={currency}
        />
      )}
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium">
      {label}
      <button type="button" onClick={onRemove} className="hover:opacity-70 leading-none">×</button>
    </span>
  )
}

interface TableProps {
  expenses: PetExpense[]
  cats: Cat[]
  catName: (id: number | null) => string
  sortKey: SortKey
  sortDir: SortDir
  onSort: (col: SortKey) => void
  thCls: (col: SortKey) => string
  onEdit: (e: PetExpense) => void
  onDelete: (e: PetExpense) => void
  canWrite: boolean
  currency: string
}

function TableView({ expenses, catName, sortKey, sortDir, onSort, thCls, onEdit, onDelete, canWrite, currency }: TableProps) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-muted/30">
            <tr>
              <th className={thCls('purchase_date')} onClick={() => onSort('purchase_date')}>
                <span className="flex items-center gap-1">Date <SortIcon col="purchase_date" sortKey={sortKey} sortDir={sortDir} /></span>
              </th>
              <th className={thCls('product_name')} onClick={() => onSort('product_name')}>
                <span className="flex items-center gap-1">Product <SortIcon col="product_name" sortKey={sortKey} sortDir={sortDir} /></span>
              </th>
              <th className={thCls('category')} onClick={() => onSort('category')}>
                <span className="flex items-center gap-1">Category <SortIcon col="category" sortKey={sortKey} sortDir={sortDir} /></span>
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Cat</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Store</th>
              <th className={thCls('quantity')} onClick={() => onSort('quantity')}>
                <span className="flex items-center gap-1">Qty <SortIcon col="quantity" sortKey={sortKey} sortDir={sortDir} /></span>
              </th>
              <th className={thCls('unit_price')} onClick={() => onSort('unit_price')}>
                <span className="flex items-center gap-1">Unit Price <SortIcon col="unit_price" sortKey={sortKey} sortDir={sortDir} /></span>
              </th>
              <th className={thCls('total_cost')} onClick={() => onSort('total_cost')}>
                <span className="flex items-center gap-1">Total <SortIcon col="total_cost" sortKey={sortKey} sortDir={sortDir} /></span>
              </th>
              {canWrite && <th className="px-3 py-2.5 w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-muted/30 transition-colors group">
                <td className="px-3 py-3 text-muted-foreground whitespace-nowrap tabular-nums">{e.purchase_date}</td>
                <td className="px-3 py-3">
                  <div className="font-medium leading-tight">{e.product_name}</div>
                  {e.brand && <div className="text-xs text-muted-foreground">{e.brand}</div>}
                  {e.is_recurring && (
                    <div className="text-[10px] text-violet-500 mt-0.5">
                      🔁 every {e.recurrence_interval_days}d
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-sm">
                    <span>{EXPENSE_CATEGORY_ICONS[e.category]}</span>
                    <span className="text-muted-foreground">{EXPENSE_CATEGORY_LABELS[e.category]}</span>
                  </span>
                </td>
                <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{catName(e.cat_id)}</td>
                <td className="px-3 py-3 text-muted-foreground max-w-[120px] truncate">
                  {e.store_url ? (
                    <a
                      href={e.store_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-violet-500"
                    >
                      {e.store_name ?? e.store_url}
                    </a>
                  ) : (
                    e.store_name ?? <span className="opacity-40">—</span>
                  )}
                </td>
                <td className="px-3 py-3 tabular-nums text-muted-foreground">
                  {e.quantity}{e.unit_label ? ` ${e.unit_label}` : ''}
                </td>
                <td className="px-3 py-3 tabular-nums text-muted-foreground">{formatCurrency(e.unit_price, currency)}</td>
                <td className="px-3 py-3 tabular-nums font-semibold">{formatCurrency(e.total_cost, currency)}</td>
                {canWrite && (
                  <td className="px-3 py-3">
                    <RowMenu expense={e} onEdit={onEdit} onDelete={onDelete} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface ListProps {
  expenses: PetExpense[]
  catName: (id: number | null) => string
  onEdit: (e: PetExpense) => void
  onDelete: (e: PetExpense) => void
  canWrite: boolean
  currency: string
}

function ListView({ expenses, catName, onEdit, onDelete, canWrite, currency }: ListProps) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 divide-y divide-border/40 overflow-hidden">
      {expenses.map((e) => (
        <div key={e.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
          {/* Category icon */}
          <div className="shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-lg mt-0.5">
            {EXPENSE_CATEGORY_ICONS[e.category]}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{e.product_name}</div>
                {e.brand && <div className="text-xs text-muted-foreground truncate">{e.brand}</div>}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold tabular-nums">{formatCurrency(e.total_cost, currency)}</div>
                <div className="text-[11px] text-muted-foreground tabular-nums">{e.purchase_date}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
              <span>{catName(e.cat_id)}</span>
              <span>{EXPENSE_CATEGORY_LABELS[e.category]}</span>
              {e.store_name && <span>{e.store_name}</span>}
              <span>{e.quantity}{e.unit_label ? ` ${e.unit_label}` : ''} @ {formatCurrency(e.unit_price, currency)}</span>
            </div>

            {e.is_recurring && (
              <div className="text-[11px] text-violet-500 mt-1">
                🔁 Recurring every {e.recurrence_interval_days} days
              </div>
            )}
            {e.notes && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{e.notes}</div>
            )}
          </div>

          {/* Row menu */}
          {canWrite && (
            <div className="shrink-0">
              <RowMenu expense={e} onEdit={onEdit} onDelete={onDelete} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function RowMenu({ expense, onEdit, onDelete }: { expense: PetExpense; onEdit: (e: PetExpense) => void; onDelete: (e: PetExpense) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Row actions"
          >
            <MoreHorizontal className="size-4" />
          </button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(expense)}>
          <Pencil className="size-3.5 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDelete(expense)}
        >
          <Trash2 className="size-3.5 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LoadingSkeleton() {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 divide-y divide-border/40 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-lg bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-muted animate-pulse rounded w-2/5" />
            <div className="h-3 bg-muted animate-pulse rounded w-1/3 opacity-60" />
          </div>
          <div className="h-4 bg-muted animate-pulse rounded w-14 shrink-0" />
        </div>
      ))}
    </div>
  )
}
