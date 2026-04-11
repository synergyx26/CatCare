import { useState } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { api } from '@/api/client'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  EXPENSE_CATEGORY_ICONS,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
} from '@/types/api'
import type { PetExpense, ExpenseCategory, Cat } from '@/types/api'
import { formatCurrency, getCurrencySymbol } from '@/lib/currency'

interface Props {
  expense: PetExpense | null
  householdId: number
  cats: Cat[]
  onClose: () => void
  currency: string
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function ExpenseModal({ expense, householdId, cats, onClose, currency }: Props) {
  const queryClient = useQueryClient()
  const isEditing = !!expense

  const [productName, setProductName] = useState(expense?.product_name ?? '')
  const [brand, setBrand] = useState(expense?.brand ?? '')
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'food')
  const [unitPrice, setUnitPrice] = useState(expense ? String(expense.unit_price) : '')
  const [quantity, setQuantity] = useState(expense ? String(expense.quantity) : '1')
  const [unitLabel, setUnitLabel] = useState(expense?.unit_label ?? '')
  const [purchaseDate, setPurchaseDate] = useState(expense?.purchase_date ?? todayStr())
  const [storeName, setStoreName] = useState(expense?.store_name ?? '')
  const [storeUrl, setStoreUrl] = useState(expense?.store_url ?? '')
  const [isRecurring, setIsRecurring] = useState(expense?.is_recurring ?? false)
  const [intervalDays, setIntervalDays] = useState(
    expense?.recurrence_interval_days ? String(expense.recurrence_interval_days) : ''
  )
  const [catId, setCatId] = useState<number | null>(expense?.cat_id ?? null)
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const parsedPrice = parseFloat(unitPrice)
  const parsedQty   = parseFloat(quantity)
  const parsedInterval = parseInt(intervalDays)

  const canSubmit =
    productName.trim().length > 0 &&
    !isNaN(parsedPrice) && parsedPrice > 0 &&
    !isNaN(parsedQty) && parsedQty > 0 &&
    purchaseDate.length > 0 &&
    (!isRecurring || (!isNaN(parsedInterval) && parsedInterval >= 1))

  const totalCost =
    !isNaN(parsedPrice) && !isNaN(parsedQty)
      ? (parsedPrice * parsedQty).toFixed(2)
      : '—'

  function buildPayload() {
    return {
      product_name: productName.trim(),
      brand: brand.trim() || null,
      category,
      unit_price: parsedPrice,
      quantity: parsedQty,
      unit_label: unitLabel.trim() || null,
      purchase_date: purchaseDate,
      store_name: storeName.trim() || null,
      store_url: storeUrl.trim() || null,
      is_recurring: isRecurring,
      recurrence_interval_days: isRecurring && !isNaN(parsedInterval) ? parsedInterval : null,
      notes: notes.trim() || null,
      cat_id: catId,
    }
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      isEditing
        ? api.updateExpense(householdId, expense!.id, { pet_expense: buildPayload() })
        : api.createExpense(householdId, { pet_expense: buildPayload() as Parameters<typeof api.createExpense>[1]['pet_expense'] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', householdId] })
      queryClient.invalidateQueries({ queryKey: ['expense_stats', householdId] })
      notify.success(isEditing ? 'Expense updated' : 'Expense added')
      onClose()
    },
    onError: () => notify.error('Failed to save expense. Please try again.'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteExpense(householdId, expense!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', householdId] })
      queryClient.invalidateQueries({ queryKey: ['expense_stats', householdId] })
      notify.success('Expense deleted')
      onClose()
    },
    onError: () => notify.error('Failed to delete expense'),
  })

  const inputCls =
    'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center"
        role="dialog"
        aria-modal
        aria-label={isEditing ? 'Edit expense' : 'Add expense'}
      >
        <div className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background ring-1 ring-border/60 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 sticky top-0 bg-background z-10">
            <h2 className="text-base font-semibold">
              {isEditing ? 'Edit Expense' : 'Add Expense'}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* Section 1 — Product */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Product name <span className="text-destructive">*</span>
                  </label>
                  <input
                    className={inputCls}
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Royal Canin Indoor"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Brand</label>
                  <input
                    className={inputCls}
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Royal Canin"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Cat</label>
                  <select
                    className={inputCls}
                    value={catId ?? ''}
                    onChange={(e) => setCatId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Whole household</option>
                    {cats.filter((c) => c.active).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category pills */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        category === cat
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-background text-muted-foreground border-border hover:border-violet-400 hover:text-foreground'
                      }`}
                    >
                      <span>{EXPENSE_CATEGORY_ICONS[cat]}</span>
                      <span>{EXPENSE_CATEGORY_LABELS[cat]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 2 — Pricing */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Pricing</label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Unit price *</label>
                  <div className="flex rounded-lg border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <span className="flex items-center px-2.5 text-sm text-muted-foreground border-r border-input bg-muted/40 rounded-l-lg whitespace-nowrap select-none">
                      {getCurrencySymbol(currency)}
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="w-full bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 rounded-r-lg"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Quantity *</label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    className={inputCls}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Unit</label>
                  <input
                    className={inputCls}
                    value={unitLabel}
                    onChange={(e) => setUnitLabel(e.target.value)}
                    placeholder="bag, can, lbs…"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Total: <span className="font-semibold text-foreground">{totalCost === '—' ? '—' : formatCurrency(parseFloat(totalCost), currency)}</span>
              </p>
            </div>

            {/* Section 3 — Where & When */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Where & When</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Purchase date *</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Store name</label>
                  <input
                    className={inputCls}
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="e.g. PetSmart"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="text-[11px] text-muted-foreground mb-1 block">Store URL</label>
                <input
                  type="url"
                  className={inputCls}
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </div>

            {/* Section 4 — Recurrence */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-input"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                <span className="text-sm font-medium">Recurring purchase</span>
              </label>
              {isRecurring && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">Repeat every</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className={`${inputCls} w-20`}
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(e.target.value)}
                    placeholder="30"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">days</span>
                </div>
              )}
            </div>

            {/* Section 5 — Notes */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional details…"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border/60 sticky bottom-0 bg-background">
            <div>
              {isEditing && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!canSubmit || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Add Expense'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
