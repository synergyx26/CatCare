import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { X } from 'lucide-react'
import { api } from '@/api/client'
import { notify } from '@/lib/notify'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { MedicationSupply } from '@/lib/helpers'
import type { ApiError, CareEvent } from '@/types/api'

function toLocalDateTimeInput(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`
}

interface Props {
  catId: number
  householdId: number
  /** The regimen start event — provides medication name */
  startEvent: CareEvent
  supply: MedicationSupply
  /** When provided: edit/delete an existing new-supply entry */
  editEvent?: CareEvent
  onClose: () => void
}

/**
 * Logs that a new supply was started (e.g. a new inhaler opened) as its own
 * medication CareEvent with details.supply_refill = true. The newest such event
 * becomes the countdown's starting count; doses before it count against the old
 * supply. Deleting a mistaken entry falls back to the previous count.
 */
export function NewSupplySheet({ catId, householdId, startEvent, supply, editEvent, onClose }: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!editEvent
  const startDetails = startEvent.details as Record<string, unknown>
  const editDetails  = (editEvent?.details ?? {}) as Record<string, unknown>
  const medicationName = (startDetails.medication_name as string) ?? 'Medication'

  // Default to the last full count — the common case is opening a new, identical pack
  const [quantity, setQuantity]     = useState(String(isEdit ? editDetails.supply_quantity ?? '' : supply.quantity))
  const [occurredAt, setOccurredAt] = useState(
    toLocalDateTimeInput(editEvent ? new Date(editEvent.occurred_at) : new Date())
  )
  const [notes, setNotes] = useState(editEvent?.notes ?? '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const quantityValid = quantity.trim() !== '' && Number.isFinite(Number(quantity)) && Number(quantity) >= 0
  const isFuture      = new Date(occurredAt).getTime() > Date.now() + 60_000
  const canSubmit     = quantityValid && !!occurredAt && !isFuture

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['care_events'] })

  const mutation = useMutation({
    mutationFn: () => {
      const base = {
        occurred_at: new Date(occurredAt).toISOString(),
        notes:       notes.trim() || null,
      }
      if (isEdit && editEvent) {
        return api.updateCareEvent(householdId, editEvent.id, {
          care_event: { ...base, details: { ...editDetails, supply_quantity: Number(quantity) } },
        })
      }
      return api.createCareEvent(householdId, {
        care_event: {
          cat_id:     catId,
          event_type: 'medication',
          ...base,
          details: {
            medication_name: medicationName,
            supply_refill:   true,
            supply_quantity: Number(quantity),
            supply_unit:     supply.unit,
          },
        },
      })
    },
    onSuccess: () => {
      invalidate()
      notify.success(isEdit ? 'Supply entry updated' : 'New supply logged')
      onClose()
    },
    onError: (err: AxiosError<ApiError>) => {
      notify.error(err.response?.data?.message ?? 'Failed to save supply')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteCareEvent(householdId, editEvent!.id),
    onSuccess: () => {
      invalidate()
      notify.success('Supply entry deleted')
      onClose()
    },
    onError: (err: AxiosError<ApiError>) => {
      notify.error(
        err.response?.status === 403
          ? 'You can only delete entries you logged.'
          : err.response?.data?.message ?? 'Failed to delete entry'
      )
    },
  })

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-supply-title"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

        {/* Sheet */}
        <div className="relative z-10 w-full sm:max-w-sm bg-background rounded-t-2xl sm:rounded-2xl shadow-xl overflow-y-auto max-h-[90dvh]">
          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 id="new-supply-title" className="font-semibold text-base">
                  {isEdit ? 'Edit new supply' : 'Start new supply'}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {medicationName}
                  {!isEdit && ` · ${supply.remaining} ${supply.unit} left in current supply`}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md"
                aria-label="Close dialog"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* Quantity */}
            <div className="space-y-1">
              <label htmlFor="new-supply-quantity" className="text-sm font-medium">
                Amount in new supply ({supply.unit})
              </label>
              <Input
                id="new-supply-quantity"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                aria-required="true"
                aria-describedby="new-supply-quantity-hint"
                autoFocus
              />
              <p id="new-supply-quantity-hint" className="text-xs text-muted-foreground">
                e.g. the puff count on a new inhaler. Add anything left in the old one if you're still using it.
              </p>
            </div>

            {/* Started at */}
            <div className="space-y-1">
              <label htmlFor="new-supply-at" className="text-sm font-medium">Started</label>
              <Input
                id="new-supply-at"
                type="datetime-local"
                value={occurredAt}
                max={toLocalDateTimeInput(new Date())}
                onChange={(e) => setOccurredAt(e.target.value)}
                aria-required="true"
                aria-invalid={isFuture ? 'true' : undefined}
                aria-describedby="new-supply-at-hint"
              />
              <p
                id="new-supply-at-hint"
                className={`text-xs ${isFuture ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {isFuture
                  ? "Can't be in the future."
                  : 'Doses logged before this time count against the previous supply.'}
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label htmlFor="new-supply-notes" className="text-sm font-medium">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                id="new-supply-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. lot number, expiry, pharmacy…"
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="-mx-5 -mb-5 px-5 py-4 border-t border-border/60 bg-muted/30 flex gap-2 items-center rounded-b-2xl">
              {isEdit && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleteMutation.isPending}
                  className="text-sm text-destructive font-medium hover:underline disabled:opacity-40"
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => mutation.mutate()}
                  disabled={!canSubmit || mutation.isPending}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium disabled:opacity-40 hover:bg-red-600 transition-colors"
                >
                  {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Log new supply'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this supply entry?</AlertDialogTitle>
            <AlertDialogDescription>
              The countdown will fall back to the previous supply count. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteConfirm(false)
                deleteMutation.mutate()
              }}
              className="active:scale-95 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
