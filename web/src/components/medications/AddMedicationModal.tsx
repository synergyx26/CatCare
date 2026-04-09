import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { api } from '@/api/client'
import { notify } from '@/lib/notify'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ApiError, CareEvent, MedicationFrequency } from '@/types/api'
import { FREQUENCY_LABELS } from '@/types/api'

type MedUnit = 'mg' | 'ml' | 'tablet'
const UNITS: MedUnit[] = ['mg', 'ml', 'tablet']

const FREQUENCIES: { value: MedicationFrequency; label: string }[] = [
  { value: 'once_daily',  label: FREQUENCY_LABELS.once_daily  },
  { value: 'twice_daily', label: FREQUENCY_LABELS.twice_daily },
  { value: 'every_8h',   label: FREQUENCY_LABELS.every_8h    },
  { value: 'every_12h',  label: FREQUENCY_LABELS.every_12h   },
  { value: 'as_needed',  label: FREQUENCY_LABELS.as_needed   },
]

function toLocalDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

function toLocalDateTimeInput(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`
}

interface Props {
  catId: number
  householdId: number
  /** When provided: edit mode — pre-fills from this event's details */
  editEvent?: CareEvent
  onClose: () => void
}

export function AddMedicationModal({ catId, householdId, editEvent, onClose }: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!editEvent

  const prefill = editEvent
    ? (editEvent.details as Record<string, unknown>)
    : null

  const [name, setName]           = useState((prefill?.medication_name as string) ?? '')
  const [dosage, setDosage]       = useState((prefill?.dosage as string) ?? '')
  const [unit, setUnit]           = useState<MedUnit>((prefill?.unit as MedUnit) ?? 'mg')
  const [frequency, setFrequency] = useState<MedicationFrequency | ''>(
    (prefill?.frequency as MedicationFrequency) ?? ''
  )
  const [startAt, setStartAt]         = useState(
    editEvent
      ? toLocalDateTimeInput(new Date(editEvent.occurred_at))
      : toLocalDateTimeInput(new Date())
  )
  const [isCourse, setIsCourse]       = useState(!!(prefill?.course_end_date))
  const [courseEndDate, setCourseEndDate] = useState(
    (prefill?.course_end_date as string) ?? toLocalDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  )
  const [notes, setNotes]             = useState(editEvent?.notes ?? '')

  // Keep unit in sync when dosage is cleared
  useEffect(() => {
    if (!dosage) setUnit('mg')
  }, [dosage])

  const canSubmit = name.trim().length > 0

  const mutation = useMutation({
    mutationFn: () => {
      const details: Record<string, unknown> = {
        medication_name:  name.trim(),
        active_medication: true,
        ...(dosage ? { dosage: dosage.trim(), unit } : {}),
        ...(frequency ? { frequency } : {}),
        ...(isCourse && courseEndDate ? { course_end_date: courseEndDate } : {}),
        // Preserve stopped state when editing a stopped med
        ...(prefill?.stopped ? { stopped: true } : {}),
      }
      const payload = {
        care_event: {
          cat_id:      catId,
          event_type:  'medication',
          occurred_at: new Date(startAt).toISOString(),
          notes:       notes.trim() || null,
          details,
        },
      }
      if (isEdit && editEvent) {
        return api.updateCareEvent(householdId, editEvent.id, payload)
      }
      return api.createCareEvent(householdId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care_events', householdId, catId, 'medication'] })
      notify.success(isEdit ? 'Medication updated' : 'Medication started')
      onClose()
    },
    onError: (err: AxiosError<ApiError>) => {
      const msg = err.response?.data?.message ?? 'Failed to save medication'
      notify.error(msg)
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div className="relative z-10 w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl shadow-xl overflow-y-auto max-h-[90dvh]">
        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">
              {isEdit ? 'Edit medication' : 'Start medication'}
            </h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-lg leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Medication name */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Medication name <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Prednisolone"
              autoFocus
            />
          </div>

          {/* Dosage + unit */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Dosage <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.1"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="e.g. 5"
                className="w-28"
              />
              {/* Unit pills — only shown when dosage is set */}
              {dosage && (
                <div className="flex gap-1.5">
                  {UNITS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        unit === u
                          ? 'bg-red-500 text-white border-red-500'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Frequency <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FREQUENCIES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFrequency(frequency === value ? '' : value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    frequency === value
                      ? 'bg-red-500 text-white border-red-500'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Start date/time */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {isEdit ? 'Date & time' : 'Start date'}
            </label>
            <Input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>

          {/* Course toggle */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isCourse}
                onChange={(e) => setIsCourse(e.target.checked)}
                className="size-4 rounded border-border"
              />
              <span className="text-sm font-medium">This is a finite course</span>
              <span className="text-xs text-muted-foreground">(e.g. antibiotics)</span>
            </label>
            {isCourse && (
              <div className="space-y-1 pl-6">
                <label className="text-xs text-muted-foreground">Course end date</label>
                <Input
                  type="date"
                  value={courseEndDate}
                  onChange={(e) => setCourseEndDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. prescribed by Dr. Smith, give with food…"
              rows={2}
              className="resize-none"
            />
          </div>

          {mutation.isError && (
            <p className="text-destructive text-sm">Failed to save. Please try again.</p>
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
              disabled={!canSubmit || mutation.isPending}
              className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium disabled:opacity-40 hover:bg-red-600 transition-colors"
            >
              {mutation.isPending
                ? isEdit ? 'Saving…' : 'Starting…'
                : isEdit ? 'Save changes' : 'Start medication'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
