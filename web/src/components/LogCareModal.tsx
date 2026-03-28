import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, Lock } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
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
import type { Cat, CareEvent, EventType, SubscriptionTier } from '@/types/api'
import { useAuthStore } from '@/store/authStore'

// ─── Types ────────────────────────────────────────────────────────────────────

type FoodType       = 'wet' | 'dry' | 'treats' | 'other'
type WeightUnit     = 'kg' | 'g'
type MedicationUnit = 'mg' | 'ml' | 'tablet'
type GroomingType   = 'bath' | 'nail_trim' | 'full_groom' | 'other'
type SymptomType    = 'vomiting' | 'coughing' | 'asthma_attack' | 'sneezing' | 'diarrhea' | 'lethargy' | 'not_eating' | 'limping' | 'eye_discharge' | 'seizure' | 'other'
type SymptomSeverity = 'mild' | 'moderate' | 'severe'

// ─── Constants ────────────────────────────────────────────────────────────────

const CARE_TYPES: { value: EventType; label: string }[] = [
  { value: 'feeding',        label: 'Feeding'        },
  { value: 'litter',         label: 'Litter'         },
  { value: 'water',          label: 'Water'          },
  { value: 'tooth_brushing', label: 'Toothbrushing'  },
  { value: 'weight',         label: 'Weight'         },
  { value: 'medication',     label: 'Medication'     },
  { value: 'symptom',        label: 'Symptom'        },
  { value: 'vet_visit',      label: 'Vet Visit'      },
  { value: 'grooming',       label: 'Grooming'       },
  { value: 'note',           label: 'Note'           },
]

const SYMPTOM_TYPES: { value: SymptomType; label: string }[] = [
  { value: 'vomiting',      label: 'Vomiting'      },
  { value: 'coughing',      label: 'Coughing'      },
  { value: 'asthma_attack', label: 'Breathing issue' },
  { value: 'sneezing',      label: 'Sneezing'      },
  { value: 'diarrhea',      label: 'Diarrhea'      },
  { value: 'lethargy',      label: 'Lethargy'      },
  { value: 'not_eating',    label: 'Not eating'    },
  { value: 'limping',       label: 'Limping'       },
  { value: 'eye_discharge', label: 'Eye discharge' },
  { value: 'seizure',       label: 'Seizure'       },
  { value: 'other',         label: 'Other'         },
]

const SYMPTOM_SEVERITIES: { value: SymptomSeverity; label: string }[] = [
  { value: 'mild',     label: 'Mild'     },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe',   label: 'Severe'   },
]

// Free tier: only these event types are available
const FREE_EVENT_TYPES: EventType[] = ['feeding', 'litter', 'water', 'tooth_brushing', 'note']

function isFreeEventType(type: EventType): boolean {
  return FREE_EVENT_TYPES.includes(type)
}

function isEventTypeAllowed(type: EventType, tier: SubscriptionTier): boolean {
  if (tier === 'pro' || tier === 'premium') return true
  return isFreeEventType(type)
}

const GROOMING_TYPES: { value: GroomingType; label: string }[] = [
  { value: 'bath',       label: 'Bath'       },
  { value: 'nail_trim',  label: 'Nail trim'  },
  { value: 'full_groom', label: 'Full groom' },
  { value: 'other',      label: 'Other'      },
]

const FOOD_TYPES: { value: FoodType; label: string }[] = [
  { value: 'wet',    label: 'Wet'    },
  { value: 'dry',    label: 'Dry'    },
  { value: 'treats', label: 'Treats' },
  { value: 'other',  label: 'Other'  },
]

const DEFAULT_PRESETS: Record<FoodType, number[]> = {
  wet:    [50, 60, 70, 80],
  dry:    [80, 90, 100],
  treats: [],
  other:  [],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDateTimeInput(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  cat:                    Cat
  householdId:            number
  initialEvent?:          CareEvent
  initialType?:           EventType
  initialMedicationName?: string
  onClose:                () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LogCareModal({ cat, householdId, initialEvent, initialType, initialMedicationName, onClose }: Props) {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const tier = (user?.subscription_tier ?? 'free') as SubscriptionTier
  const isEditing   = !!initialEvent

  // If creating and the requested type is restricted, fall back to 'feeding'
  const rawInitType = (initialEvent?.event_type ?? initialType ?? 'feeding') as EventType
  const initType    = (!isEditing && !isEventTypeAllowed(rawInitType, tier))
    ? 'feeding'
    : rawInitType
  const initDetails = (initialEvent?.details ?? {}) as Record<string, unknown>

  const initFoodType       = (initDetails.food_type as FoodType) ?? 'wet'
  const initAmountGrams    = typeof initDetails.amount_grams === 'number' ? initDetails.amount_grams : null
  const catPresets: Record<FoodType, number[]> = {
    wet:    cat.feeding_presets?.wet    ?? DEFAULT_PRESETS.wet,
    dry:    cat.feeding_presets?.dry    ?? DEFAULT_PRESETS.dry,
    treats: cat.feeding_presets?.treats ?? DEFAULT_PRESETS.treats,
    other:  cat.feeding_presets?.other  ?? DEFAULT_PRESETS.other,
  }
  const initAmountIsPreset = initAmountGrams != null && catPresets[initFoodType].includes(initAmountGrams)

  const initMedicationName = (initDetails.medication_name as string) || initialMedicationName || ''
  const initMedicationDosage = (initDetails.dosage as string) ?? ''
  const initMedicationUnit = (initDetails.unit as MedicationUnit) ?? 'mg'

  // ── State ───────────────────────────────────────────────────────────────────
  const [eventType,       setEventType]       = useState<EventType>(initType)
  const [notes,           setNotes]           = useState(initialEvent?.notes ?? '')
  const [occurredAt,      setOccurredAt]      = useState(() => {
    if (initialEvent) return toLocalDateTimeInput(new Date(initialEvent.occurred_at))
    if (initType === 'vet_visit' || initType === 'grooming') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      return toLocalDateTimeInput(tomorrow)
    }
    return toLocalDateTimeInput(new Date())  // feeding, litter, water, weight, note, symptom — all default to now
  })

  // Feeding
  const [foodType,        setFoodType]        = useState<FoodType>(initFoodType)
  const [selectedAmount,  setSelectedAmount]  = useState<number | null>(
    initAmountIsPreset ? initAmountGrams : null
  )
  const [isCustom,        setIsCustom]        = useState(!initAmountIsPreset && initAmountGrams != null)
  const [customAmount,    setCustomAmount]    = useState(
    !initAmountIsPreset && initAmountGrams != null ? String(initAmountGrams) : ''
  )

  // Weight
  const [weightValue,     setWeightValue]     = useState(
    typeof initDetails.weight_value === 'number' ? String(initDetails.weight_value) : ''
  )
  const [weightUnit,      setWeightUnit]      = useState<WeightUnit>(
    (initDetails.weight_unit as WeightUnit) ?? 'kg'
  )

  // Medication
  const [medicationName,   setMedicationName]   = useState(initMedicationName)
  const [medicationDosage, setMedicationDosage] = useState(initMedicationDosage)
  const [medicationUnit,   setMedicationUnit]   = useState<MedicationUnit>(initMedicationUnit)

  // Vet visit
  const [vetReason,  setVetReason]  = useState((initDetails.reason as string) ?? '')
  const [vetName,    setVetName]    = useState((initDetails.vet_name as string) ?? cat.vet_name ?? '')
  const [vetClinic,  setVetClinic]  = useState((initDetails.vet_clinic as string) ?? cat.vet_clinic ?? '')

  // Grooming
  const [groomingType, setGroomingType] = useState<GroomingType>(
    (initDetails.grooming_type as GroomingType) ?? 'bath'
  )

  // Symptom
  const [symptomType,     setSymptomType]     = useState<SymptomType>(
    (initDetails.symptom_type as SymptomType) ?? 'vomiting'
  )
  const [symptomSeverity, setSymptomSeverity] = useState<SymptomSeverity>(
    (initDetails.severity as SymptomSeverity) ?? 'mild'
  )
  const [symptomDuration, setSymptomDuration] = useState(
    initDetails.duration_minutes != null ? String(initDetails.duration_minutes) : ''
  )

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // ── Feeding helpers ─────────────────────────────────────────────────────────
  const presets = catPresets[foodType]

  function pickFoodType(type: FoodType) {
    setFoodType(type)
    setSelectedAmount(null)
    setIsCustom(false)
    setCustomAmount('')
  }

  function pickPreset(g: number) {
    setSelectedAmount(g)
    setIsCustom(false)
    setCustomAmount('')
  }

  const parsedCustom    = parseFloat(customAmount)
  const effectiveAmount = isCustom ? parsedCustom : selectedAmount

  // ── Validation ──────────────────────────────────────────────────────────────
  const canSubmit = (() => {
    if (eventType === 'feeding') {
      if (foodType === 'treats' || foodType === 'other') return true
      return selectedAmount != null || (isCustom && customAmount !== '' && !isNaN(parsedCustom))
    }
    if (eventType === 'weight') {
      return weightValue !== '' && !isNaN(parseFloat(weightValue))
    }
    if (eventType === 'medication') {
      return medicationName.trim() !== ''
    }
    if (eventType === 'vet_visit') {
      return vetReason.trim() !== ''
    }
    return true
  })()

  // ── Build details payload ───────────────────────────────────────────────────
  function buildDetails(): Record<string, unknown> {
    if (eventType === 'feeding') {
      return {
        food_type: foodType,
        ...(effectiveAmount != null && !isNaN(effectiveAmount as number)
          ? { amount_grams: effectiveAmount }
          : {}),
      }
    }
    if (eventType === 'weight') {
      return { weight_value: parseFloat(weightValue), weight_unit: weightUnit }
    }
    if (eventType === 'medication') {
      return {
        medication_name: medicationName.trim(),
        ...(medicationDosage ? { dosage: medicationDosage, unit: medicationUnit } : {}),
      }
    }
    if (eventType === 'vet_visit') {
      return {
        reason: vetReason.trim(),
        ...(vetName.trim() ? { vet_name: vetName.trim() } : {}),
        ...(vetClinic.trim() ? { vet_clinic: vetClinic.trim() } : {}),
      }
    }
    if (eventType === 'grooming') {
      return { grooming_type: groomingType }
    }
    if (eventType === 'symptom') {
      const dur = parseInt(symptomDuration, 10)
      return {
        symptom_type: symptomType,
        severity:     symptomSeverity,
        ...(symptomDuration !== '' && !isNaN(dur) ? { duration_minutes: dur } : {}),
      }
    }
    return {}
  }

  // ── Mutations ───────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => {
      const base = {
        occurred_at: new Date(occurredAt).toISOString(),
        notes:       notes.trim() || null,
        details:     buildDetails(),
      }
      if (isEditing) {
        return api.updateCareEvent(householdId, initialEvent!.id, { care_event: base })
      }
      return api.createCareEvent(householdId, {
        care_event: { cat_id: cat.id, event_type: eventType, ...base },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care_events'] })
      queryClient.invalidateQueries({ queryKey: ['upcoming_appointments'] })
      const typeLabel = CARE_TYPES.find((t) => t.value === eventType)?.label.toLowerCase() ?? ''
      toast.success(isEditing ? 'Changes saved!' : `${cat.name}: ${typeLabel} logged`)
      onClose()
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        toast.error("You can only edit entries you logged.")
      } else {
        toast.error('Something went wrong. Please try again.')
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteCareEvent(householdId, initialEvent!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care_events'] })
      queryClient.invalidateQueries({ queryKey: ['upcoming_appointments'] })
      toast.success('Entry deleted')
      onClose()
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        toast.error("You can only delete entries you logged.")
      } else {
        toast.error('Failed to delete. Please try again.')
      }
    },
  })

  // ── Labels ──────────────────────────────────────────────────────────────────
  const typeLabel  = CARE_TYPES.find((t) => t.value === eventType)?.label.toLowerCase() ?? ''
  const modalTitle = isEditing
    ? `Edit ${typeLabel} — ${cat.name}`
    : `Log care — ${cat.name}`
  const submitLabel = mutation.isPending
    ? 'Saving...'
    : isEditing
      ? 'Save changes'
      : `Log ${typeLabel}`

  // ── Pill button helper ────────────────────────────────────────────────────
  const pillClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
      active
        ? 'bg-sky-500 text-white border-sky-500'
        : 'border-border hover:bg-sky-50 dark:hover:bg-sky-950/20'
    }`

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />

        {/* Sheet */}
        <div className="relative z-10 w-full sm:max-w-sm bg-background rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-xl shadow-sky-500/5 max-h-[90vh] overflow-y-auto">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">{modalTitle}</h2>
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          {/* Care type selector */}
          {!isEditing && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Type</p>
              <div className="flex gap-2 flex-wrap">
                {CARE_TYPES.map(({ value, label }) => {
                  const allowed = isEventTypeAllowed(value, tier)
                  return (
                    <button
                      key={value}
                      onClick={() => {
                        if (!allowed) {
                          toast.error('Upgrade to Pro or Premium to log this event type.')
                          return
                        }
                        setEventType(value)
                      }}
                      title={!allowed ? 'Requires Pro or Premium' : undefined}
                      className={
                        !allowed
                          ? 'px-3 py-1.5 rounded-full text-sm font-medium border border-border transition-colors opacity-50 cursor-not-allowed flex items-center gap-1'
                          : `${pillClass(eventType === value)} flex items-center gap-1`
                      }
                    >
                      {!allowed && <Lock className="size-3 shrink-0" />}
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Feeding fields */}
          {eventType === 'feeding' && (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">Food type</p>
                <div className="flex gap-2 flex-wrap">
                  {FOOD_TYPES.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => pickFoodType(value)}
                      className={pillClass(foodType === value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {foodType !== 'treats' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Amount</p>
                  <div className="flex gap-2 flex-wrap">
                    {presets.map((g) => (
                      <button
                        key={g}
                        onClick={() => pickPreset(g)}
                        className={pillClass(!isCustom && selectedAmount === g)}
                      >
                        {g}g
                      </button>
                    ))}
                    <button
                      onClick={() => { setIsCustom(true); setSelectedAmount(null) }}
                      className={pillClass(isCustom)}
                    >
                      Custom
                    </button>
                  </div>

                  {isCustom && (
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        type="number"
                        min="1"
                        placeholder="e.g. 75"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="w-28"
                        autoFocus
                      />
                      <span className="text-sm text-muted-foreground">grams</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Weight fields */}
          {eventType === 'weight' && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Weight</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 4.5"
                  value={weightValue}
                  onChange={(e) => setWeightValue(e.target.value)}
                  className="w-28"
                  autoFocus
                />
                <div className="flex gap-1">
                  {(['kg', 'g'] as WeightUnit[]).map((u) => (
                    <button
                      key={u}
                      onClick={() => setWeightUnit(u)}
                      className={pillClass(weightUnit === u)}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Medication fields */}
          {eventType === 'medication' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Medication name</label>
                <Input
                  placeholder="e.g. Prednisolone"
                  value={medicationName}
                  onChange={(e) => setMedicationName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Dosage <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="e.g. 5"
                    value={medicationDosage}
                    onChange={(e) => setMedicationDosage(e.target.value)}
                    className="w-28"
                  />
                  <div className="flex gap-1">
                    {(['mg', 'ml', 'tablet'] as MedicationUnit[]).map((u) => (
                      <button
                        key={u}
                        onClick={() => setMedicationUnit(u)}
                        className={pillClass(medicationUnit === u)}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vet visit fields */}
          {eventType === 'vet_visit' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Reason for visit</label>
                <Input
                  placeholder="e.g. Annual checkup, Illness, Follow-up"
                  value={vetReason}
                  onChange={(e) => setVetReason(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Vet name <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. Dr. Smith"
                  value={vetName}
                  onChange={(e) => setVetName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Clinic <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. City Animal Hospital"
                  value={vetClinic}
                  onChange={(e) => setVetClinic(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Grooming fields */}
          {eventType === 'grooming' && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Grooming type</p>
              <div className="flex gap-2 flex-wrap">
                {GROOMING_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setGroomingType(value)}
                    className={pillClass(groomingType === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Symptom fields */}
          {eventType === 'symptom' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">What happened?</p>
                <div className="flex gap-2 flex-wrap">
                  {SYMPTOM_TYPES.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setSymptomType(value)}
                      className={pillClass(symptomType === value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Severity</p>
                <div className="flex gap-2">
                  {SYMPTOM_SEVERITIES.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setSymptomSeverity(value)}
                      className={
                        symptomSeverity === value
                          ? value === 'severe'
                            ? 'px-3 py-1.5 rounded-full text-sm font-medium border bg-red-500 text-white border-red-500 cursor-pointer'
                            : value === 'moderate'
                              ? 'px-3 py-1.5 rounded-full text-sm font-medium border bg-orange-500 text-white border-orange-500 cursor-pointer'
                              : 'px-3 py-1.5 rounded-full text-sm font-medium border bg-yellow-500 text-white border-yellow-500 cursor-pointer'
                          : 'px-3 py-1.5 rounded-full text-sm font-medium border border-border hover:bg-muted/60 cursor-pointer'
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Duration <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g. 5"
                    value={symptomDuration}
                    onChange={(e) => setSymptomDuration(e.target.value)}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>
            </div>
          )}

          {/* Toothbrushing hint */}
          {eventType === 'tooth_brushing' && (
            <p className="text-xs text-muted-foreground">
              Records a toothbrushing session. Use the notes field for any observations.
            </p>
          )}

          {/* Note hint */}
          {eventType === 'note' && (
            <p className="text-xs text-muted-foreground">
              Use the notes field below to write your observation.
            </p>
          )}

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
              Notes{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                eventType === 'note'
                  ? 'Write your observation...'
                  : 'e.g. ate slowly, left some food...'
              }
              rows={2}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
          >
            {submitLabel}
          </Button>

          {/* Delete — edit mode only */}
          {isEditing && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete entry'}
            </Button>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This care event will be permanently removed. This action cannot be undone.
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
