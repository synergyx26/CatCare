import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { X } from 'lucide-react'
import { api } from '@/api/client'
import { notify } from '@/lib/notify'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ApiError, CareEvent, MedicationFrequency } from '@/types/api'
import { FREQUENCY_LABELS } from '@/types/api'

type MedUnit = string
const PRESET_UNITS = ['mg', 'ml', 'tablet'] as const
const isPresetUnit = (u: string) => (PRESET_UNITS as readonly string[]).includes(u)

const PRESET_SUPPLY_UNITS = ['puffs', 'tablets', 'ml', 'doses'] as const
const isPresetSupplyUnit = (u: string) => (PRESET_SUPPLY_UNITS as readonly string[]).includes(u)

const FREQUENCIES: { value: MedicationFrequency; label: string }[] = [
  { value: 'once_daily',      label: FREQUENCY_LABELS.once_daily      },
  { value: 'twice_daily',     label: FREQUENCY_LABELS.twice_daily     },
  { value: 'every_8h',        label: FREQUENCY_LABELS.every_8h        },
  { value: 'every_12h',       label: FREQUENCY_LABELS.every_12h       },
  { value: 'every_other_day', label: FREQUENCY_LABELS.every_other_day },
  { value: 'every_3_days',    label: FREQUENCY_LABELS.every_3_days    },
  { value: 'every_week',      label: FREQUENCY_LABELS.every_week      },
  { value: 'as_needed',       label: FREQUENCY_LABELS.as_needed       },
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
  const prefillUnit = (prefill?.unit as string) ?? 'mg'
  const [unit, setUnit]           = useState<MedUnit>(isPresetUnit(prefillUnit) ? prefillUnit : 'other')
  const [customUnit, setCustomUnit] = useState(isPresetUnit(prefillUnit) ? '' : prefillUnit)
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

  // Supply countdown. When the regimen already tracks supply, the count itself is
  // only changed by logging a new supply on the medication card — editing here
  // would silently reset the snapshot and lose track of doses given since.
  const wasTrackingSupply = prefill?.supply_quantity != null && !!prefill?.supply_refilled_at
  const prefillSupplyUnit = (prefill?.supply_unit as string) ?? 'puffs'
  const [trackSupply, setTrackSupply]       = useState(wasTrackingSupply)
  const [supplyQuantity, setSupplyQuantity] = useState('')
  const [supplyUnit, setSupplyUnit]         = useState(isPresetSupplyUnit(prefillSupplyUnit) ? prefillSupplyUnit : 'other')
  const [customSupplyUnit, setCustomSupplyUnit] = useState(isPresetSupplyUnit(prefillSupplyUnit) ? '' : prefillSupplyUnit)
  const [supplyPerDose, setSupplyPerDose]   = useState(String(prefill?.supply_per_dose ?? 1))
  const [lowThreshold, setLowThreshold]     = useState(
    prefill?.supply_low_threshold != null ? String(prefill.supply_low_threshold) : ''
  )

  // Keep unit in sync when dosage is cleared
  useEffect(() => {
    if (!dosage) { setUnit('mg'); setCustomUnit('') }
  }, [dosage])

  const needsSupplyCount   = trackSupply && !wasTrackingSupply
  const resolvedSupplyUnit = supplyUnit === 'other' ? customSupplyUnit.trim() : supplyUnit
  const isNonNegative = (v: string) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0
  const supplyValid = !trackSupply || (
    resolvedSupplyUnit.length > 0 &&
    isNonNegative(supplyPerDose) && Number(supplyPerDose) > 0 &&
    (!needsSupplyCount || isNonNegative(supplyQuantity)) &&
    (lowThreshold.trim() === '' || isNonNegative(lowThreshold))
  )

  const canSubmit = name.trim().length > 0 && supplyValid

  const mutation = useMutation({
    mutationFn: () => {
      const details: Record<string, unknown> = {
        medication_name:  name.trim(),
        active_medication: true,
        ...(dosage ? { dosage: dosage.trim(), unit: unit === 'other' ? customUnit.trim() || 'other' : unit } : {}),
        ...(frequency ? { frequency } : {}),
        ...(isCourse && courseEndDate ? { course_end_date: courseEndDate } : {}),
        ...(trackSupply ? {
          supply_unit:     resolvedSupplyUnit,
          supply_per_dose: Number(supplyPerDose),
          ...(lowThreshold.trim() !== '' ? { supply_low_threshold: Number(lowThreshold) } : {}),
          // New count → snapshot taken now; otherwise carry the existing snapshot forward
          ...(needsSupplyCount
            ? { supply_quantity: Number(supplyQuantity), supply_refilled_at: new Date().toISOString() }
            : { supply_quantity: prefill?.supply_quantity, supply_refilled_at: prefill?.supply_refilled_at }),
        } : {}),
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
      queryClient.invalidateQueries({ queryKey: ['care_events'] })
      notify.success(isEdit ? 'Medication updated' : 'Medication started')
      onClose()
    },
    onError: (err: AxiosError<ApiError>) => {
      const msg = err.response?.data?.message ?? 'Failed to save medication'
      notify.error(msg)
    },
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-med-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* Sheet */}
      <div className="relative z-10 w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl shadow-xl overflow-y-auto max-h-[90dvh]">
        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 id="add-med-modal-title" className="font-semibold text-base">
              {isEdit ? 'Edit medication' : 'Start medication'}
            </h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md"
              aria-label="Close dialog"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {/* Medication name */}
          <div className="space-y-1">
            <label htmlFor="add-med-name" className="text-sm font-medium">
              Medication name <span aria-hidden="true" className="text-destructive">*</span>
            </label>
            <Input
              id="add-med-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Prednisolone"
              aria-required="true"
              autoFocus
            />
          </div>

          {/* Dosage + unit */}
          <div className="space-y-1">
            <label htmlFor="add-med-dosage" className="text-sm font-medium">
              Dosage <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="add-med-dosage"
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
                <>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Dosage unit">
                    {([...PRESET_UNITS, 'other']).map((u) => (
                      <button
                        key={u}
                        type="button"
                        role="radio"
                        aria-checked={unit === u}
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
                  {unit === 'other' && (
                    <Input
                      type="text"
                      placeholder="e.g. puff"
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                      className="w-24"
                      aria-label="Custom unit"
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <p id="add-med-freq-label" className="text-sm font-medium">
              Frequency <span className="text-muted-foreground font-normal">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="add-med-freq-label">
              {FREQUENCIES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={frequency === value}
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
            <label htmlFor="add-med-start-at" className="text-sm font-medium">
              {isEdit ? 'Date & time' : 'Start date'}
            </label>
            <Input
              id="add-med-start-at"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>

          {/* Course toggle */}
          <div className="space-y-2">
            <label htmlFor="add-med-is-course" className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="add-med-is-course"
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
                <label htmlFor="add-med-course-end" className="text-xs text-muted-foreground">Course end date</label>
                <Input
                  id="add-med-course-end"
                  type="date"
                  value={courseEndDate}
                  onChange={(e) => setCourseEndDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Supply countdown */}
          <div className="space-y-2">
            <label htmlFor="add-med-track-supply" className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="add-med-track-supply"
                type="checkbox"
                checked={trackSupply}
                onChange={(e) => setTrackSupply(e.target.checked)}
                className="size-4 rounded border-border"
              />
              <span className="text-sm font-medium">Track remaining supply</span>
              <span className="text-xs text-muted-foreground">(e.g. inhaler puffs)</span>
            </label>
            {trackSupply && (
              <div className="space-y-3 pl-6">
                {needsSupplyCount ? (
                  <div className="space-y-1">
                    <label htmlFor="add-med-supply-qty" className="text-xs text-muted-foreground">
                      Amount on hand now <span aria-hidden="true" className="text-destructive">*</span>
                    </label>
                    <Input
                      id="add-med-supply-qty"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={supplyQuantity}
                      onChange={(e) => setSupplyQuantity(e.target.value)}
                      placeholder="e.g. 120"
                      className="w-28"
                      aria-required="true"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Use <span className="font-medium">New supply</span> on the medication card when you open a new pack or inhaler.
                  </p>
                )}

                <div className="space-y-1">
                  <p id="add-med-supply-unit-label" className="text-xs text-muted-foreground">Counted in</p>
                  <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-labelledby="add-med-supply-unit-label">
                    {([...PRESET_SUPPLY_UNITS, 'other']).map((u) => (
                      <button
                        key={u}
                        type="button"
                        role="radio"
                        aria-checked={supplyUnit === u}
                        onClick={() => setSupplyUnit(u)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          supplyUnit === u
                            ? 'bg-red-500 text-white border-red-500'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                    {supplyUnit === 'other' && (
                      <Input
                        type="text"
                        placeholder="e.g. sachets"
                        value={customSupplyUnit}
                        onChange={(e) => setCustomSupplyUnit(e.target.value)}
                        maxLength={30}
                        className="w-28"
                        aria-label="Custom supply unit"
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="space-y-1">
                    <label htmlFor="add-med-supply-per-dose" className="text-xs text-muted-foreground">
                      Used per dose
                    </label>
                    <Input
                      id="add-med-supply-per-dose"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={supplyPerDose}
                      onChange={(e) => setSupplyPerDose(e.target.value)}
                      className="w-24"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="add-med-supply-low" className="text-xs text-muted-foreground">
                      Reorder when at or below
                    </label>
                    <Input
                      id="add-med-supply-low"
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={lowThreshold}
                      onChange={(e) => setLowThreshold(e.target.value)}
                      placeholder="20% left"
                      className="w-28"
                      aria-describedby="add-med-supply-low-hint"
                    />
                  </div>
                </div>
                <p id="add-med-supply-low-hint" className="text-xs text-muted-foreground">
                  Leave the reorder level blank to be warned at 20% remaining. Allow for pharmacy lead time.
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label htmlFor="add-med-notes" className="text-sm font-medium">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              id="add-med-notes"
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
