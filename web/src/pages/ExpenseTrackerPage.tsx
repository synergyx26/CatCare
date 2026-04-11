import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { ReceiptText, Plus } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { ExpenseStatsSection } from '@/components/expenses/ExpenseStatsSection'
import { ExpenseListSection } from '@/components/expenses/ExpenseListSection'
import { UpcomingRecurringSection } from '@/components/expenses/UpcomingRecurringSection'
import { ExpenseModal } from '@/components/expenses/ExpenseModal'
import { buttonVariants } from '@/components/ui/button'
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
import { notify } from '@/lib/notify'
import type { PetExpense, ExpenseRange, Cat } from '@/types/api'

type ModalState = { open: false } | { open: true; expense: PetExpense | null }

export function ExpenseTrackerPage() {
  const { householdId } = useParams<{ householdId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const hId = Number(householdId)

  const [selectedRange, setSelectedRange] = useState<ExpenseRange>('1m')
  const [catFilter, setCatFilter] = useState<number | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modalState, setModalState] = useState<ModalState>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<PetExpense | null>(null)

  const tier = user?.subscription_tier ?? 'free'
  const canAccess = tier === 'premium'

  // Fetch cats for dropdowns / chart labels
  const { data: catsData } = useQuery({
    queryKey: ['cats', hId],
    queryFn: () => api.getCats(hId),
    enabled: canAccess && !!hId,
  })
  const cats: Cat[] = catsData?.data?.data ?? []

  // Membership role (for sitter read-only enforcement)
  const { data: householdsData } = useQuery({
    queryKey: ['households'],
    queryFn: () => api.getHouseholds(),
    enabled: canAccess,
  })
  const households = householdsData?.data?.data ?? []
  const household = households.find((h: { id: number }) => h.id === hId)
  const currentRole = household?.members?.find((m: { id: number }) => m.id === user?.id)?.role ?? 'member'
  const currency: string = household?.currency ?? 'USD'

  // Stats query
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['expense_stats', hId, selectedRange],
    queryFn: () => api.getExpenseStats(hId, selectedRange),
    enabled: canAccess && !!hId,
    staleTime: 5 * 60_000,
  })
  const stats = statsData?.data?.data

  // Expenses list query
  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', hId, catFilter, categoryFilter, selectedRange, dateFrom, dateTo],
    queryFn: () =>
      api.getExpenses(hId, {
        range: dateFrom || dateTo ? undefined : selectedRange,
        catId: catFilter ?? undefined,
        category: categoryFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    enabled: canAccess && !!hId,
  })
  const expenses: PetExpense[] = expensesData?.data?.data ?? []

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (expense: PetExpense) => api.deleteExpense(hId, expense.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', hId] })
      queryClient.invalidateQueries({ queryKey: ['expense_stats', hId] })
      notify.success('Expense deleted')
      setDeleteTarget(null)
    },
    onError: () => notify.error('Failed to delete expense'),
  })

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <PageHeader
          title="Expenses"
          subtitle="Track what you spend on pet care"
          backTo={{ label: 'Back to dashboard', onClick: () => navigate('/dashboard') }}
        />
        <div className="mt-6">
          <EmptyState
            icon={ReceiptText}
            title="Premium feature"
            description="Upgrade to Premium to track expenses across all your pets and see spending analytics."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Track what you spend on pet care"
        backTo={{ label: 'Back to dashboard', onClick: () => navigate('/dashboard') }}
        action={
          currentRole !== 'sitter' ? (
            <button
              onClick={() => setModalState({ open: true, expense: null })}
              className={buttonVariants({ size: 'sm' })}
            >
              <Plus className="size-4 mr-1" />
              Add Expense
            </button>
          ) : undefined
        }
      />

      {/* Stats + charts */}
      <ExpenseStatsSection
        range={selectedRange}
        setRange={setSelectedRange}
        stats={stats}
        isLoading={statsLoading}
        cats={cats}
        currency={currency}
      />

      {/* Upcoming recurring */}
      {stats?.upcoming && stats.upcoming.length > 0 && (
        <UpcomingRecurringSection
          upcoming={stats.upcoming}
          cats={cats}
          onEdit={(expense) => setModalState({ open: true, expense })}
          onDelete={setDeleteTarget}
          canWrite={currentRole !== 'sitter'}
          currency={currency}
        />
      )}

      {/* Expense list */}
      <ExpenseListSection
        expenses={expenses}
        isLoading={expensesLoading}
        cats={cats}
        catFilter={catFilter}
        setCatFilter={setCatFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        onEdit={(expense) => setModalState({ open: true, expense })}
        onDelete={setDeleteTarget}
        canWrite={currentRole !== 'sitter'}
        currency={currency}
      />

      {/* Add/Edit modal */}
      {modalState.open && (
        <ExpenseModal
          expense={modalState.expense}
          householdId={hId}
          cats={cats}
          onClose={() => setModalState({ open: false })}
          currency={currency}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.product_name}" will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
