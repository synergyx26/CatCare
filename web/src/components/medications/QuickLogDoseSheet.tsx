import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { api } from '@/api/client'
import { notify } from '@/lib/notify'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ApiError, CareEvent } from '@/types/api'

function toLocalDateTimeInput(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`
}

interface Props {
  catId: number
  householdId: number
  /** The "start" event for this medication — provides name, dosage, unit */
  startEvent: CareEvent
  onClose: () => void
}

export function QuickLogDoseSheet({ catId, householdId, startEvent, onClose }: Props) {
  const queryClient = useQueryClient()
  const d = startEvent.details as Record<string, unknown>

  const medicationName = (d.medication_name as string) ?? 'Medication'
  const dosage         = (d.dosage as string) ?? ''
  const unit           = (d.unit   as string) ?? ''

  const [occurredAt, setOccurredAt] = useState(toLocalDateTimeInput(new Date()))
  const [notes, setNotes]           = useState('')

  const doseLabel = dosage ? `${dosage} ${unit}` : null

  const mutation = useMutation({
    mutationFn: () =>
      api.createCareEvent(householdId, {
        care_event: {
          cat_id:      catId,
          event_type:  'medication',
          occurred_at: new Date(occurredAt).toISOString(),
          notes:       notes.trim() || null,
          details: {
            medication_name: medicationName,
            ...(dosage ? { dosage, unit } : {}),
            // No active_medication flag — this is a dose log, not a start event
          },
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care_events'] })
      notify.success('Dose logged')
      onClose()
    },
    onError: (err: AxiosError<ApiError>) => {
      const msg = err.response?.data?.message ?? 'Failed to log dose'
      notify.error(msg)
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div className="relative z-10 w-full sm:max-w-sm bg-background rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-base">Log dose</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {medicationName}{doseLabel ? ` · ${doseLabel}` : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-lg leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Date & time */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Date & time</label>
            <Input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any observations…"
              rows={2}
              className="resize-none"
            />
          </div>

          {mutation.isError && (
            <p className="text-destructive text-sm">Failed to log dose. Please try again.</p>
          )}

          <div className="-mx-5 -mb-5 px-5 py-4 border-t border-border/60 bg-muted/30 flex gap-2 justify-end rounded-b-2xl">
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
              disabled={mutation.isPending}
              className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium disabled:opacity-40 hover:bg-red-600 transition-colors"
            >
              {mutation.isPending ? 'Logging…' : 'Log dose'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
