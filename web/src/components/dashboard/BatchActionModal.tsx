import { useState } from 'react'
import { X, Lock } from 'lucide-react'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { HouseholdBatchAction } from '@/types/api'
import type { EventType, SubscriptionTier } from '@/types/api'
import { useAuthStore } from '@/store/authStore'

// Event types that make sense for batch logging (exclude weight/vet_visit
// which require per-cat data that varies per animal)
const BATCH_TYPES: { value: EventType; label: string }[] = [
  { value: 'feeding',        label: 'Feeding'       },
  { value: 'litter',         label: 'Litter'        },
  { value: 'water',          label: 'Water'         },
  { value: 'tooth_brushing', label: 'Toothbrushing' },
  { value: 'medication',     label: 'Medication'    },
  { value: 'symptom',        label: 'Symptom'       },
  { value: 'grooming',       label: 'Grooming'      },
  { value: 'note',           label: 'Note'          },
]

type FoodType      = 'wet' | 'dry' | 'treats' | 'other'
type GroomingType  = 'bath' | 'nail_trim' | 'full_groom' | 'other'
type MedUnit       = 'mg' | 'ml' | 'tablet'
type SymptomType   = 'vomiting' | 'coughing' | 'asthma_attack' | 'sneezing' | 'diarrhea' | 'lethargy' | 'not_eating' | 'limping' | 'eye_discharge' | 'seizure' | 'other'
type SymptomSeverity = 'mild' | 'moderate' | 'severe'

const FREE_BATCH_TYPES: EventType[] = ['feeding', 'litter', 'water', 'tooth_brushing', 'note']

function isBatchTypeAllowed(type: EventType, tier: SubscriptionTier): boolean {
  if (tier === 'pro' || tier === 'premium') return true
  return FREE_BATCH_TYPES.includes(type)
}

export interface BatchActionPayload {
  label: string
  event_type: EventType
  details: Record<string, unknown>
  default_notes: string | null
}

interface Props {
  /** When provided the modal is in edit mode and pre-fills from this action. */
  initialAction?: HouseholdBatchAction
  onSave: (action: BatchActionPayload) => void
  onClose: () => void
}

const pillClass = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
    active
      ? 'bg-sky-500 text-white border-sky-500'
      : 'border-border hover:bg-sky-50 dark:hover:bg-sky-950/20'
  }`

function detailsToState(d: Record<string, unknown>) {
  return {
    foodType:        (d.food_type       as FoodType)        ?? 'wet',
    amountGrams:     d.amount_grams != null ? String(d.amount_grams) : '',
    medName:         (d.medication_name as string)          ?? '',
    medDosage:       (d.dosage          as string)          ?? '',
    medUnit:         (d.unit            as MedUnit)         ?? 'mg',
    groomType:       (d.grooming_type   as GroomingType)    ?? 'bath',
    symptomType:     (d.symptom_type    as SymptomType)     ?? 'vomiting',
    symptomSeverity: (d.severity        as SymptomSeverity) ?? 'mild',
  }
}

export function BatchActionModal({ initialAction, onSave, onClose }: Props) {
  const { user } = useAuthStore()
  const tier = (user?.subscription_tier ?? 'free') as SubscriptionTier
  const isEditing = !!initialAction

  const prefill = initialAction ? detailsToState(initialAction.details) : null

  const [label,           setLabel]           = useState(initialAction?.label ?? '')
  const [eventType,       setEventType]       = useState<EventType>(initialAction?.event_type ?? 'water')
  const [foodType,        setFoodType]        = useState<FoodType>(prefill?.foodType ?? 'wet')
  const [amountGrams,     setAmountGrams]     = useState(prefill?.amountGrams ?? '')
  const [medName,         setMedName]         = useState(prefill?.medName ?? '')
  const [medDosage,       setMedDosage]       = useState(prefill?.medDosage ?? '')
  const [medUnit,         setMedUnit]         = useState<MedUnit>(prefill?.medUnit ?? 'mg')
  const [groomType,       setGroomType]       = useState<GroomingType>(prefill?.groomType ?? 'bath')
  const [symptomType,     setSymptomType]     = useState<SymptomType>(prefill?.symptomType ?? 'vomiting')
  const [symptomSeverity, setSymptomSeverity] = useState<SymptomSeverity>(prefill?.symptomSeverity ?? 'mild')
  const [defaultNotes,    setDefaultNotes]    = useState(initialAction?.default_notes ?? '')

  function buildDetails(): Record<string, unknown> {
    if (eventType === 'feeding') {
      const amt = parseFloat(amountGrams)
      return {
        food_type: foodType,
        ...(amountGrams && !isNaN(amt) ? { amount_grams: amt } : {}),
      }
    }
    if (eventType === 'medication') {
      return {
        medication_name: medName.trim(),
        ...(medDosage ? { dosage: medDosage, unit: medUnit } : {}),
      }
    }
    if (eventType === 'grooming') return { grooming_type: groomType }
    if (eventType === 'symptom') return { symptom_type: symptomType, severity: symptomSeverity }
    return {}
  }

  const canSave = label.trim() !== '' && (eventType !== 'medication' || medName.trim() !== '')

  function handleSave() {
    if (!canSave) return
    onSave({
      label: label.trim(),
      event_type: eventType,
      details: buildDetails(),
      default_notes: defaultNotes.trim() || null,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-sm bg-background rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">
            {isEditing ? 'Edit quick action' : 'New quick action'}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Label */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Button label</label>
          <Input
            placeholder="e.g. Morning kibble, Evening wet food"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
          />
        </div>

        {/* Event type */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Type</p>
          <div className="flex gap-2 flex-wrap">
            {BATCH_TYPES.map(({ value, label: typeLabel }) => {
              const allowed = isBatchTypeAllowed(value, tier)
              return (
                <button
                  key={value}
                  onClick={() => {
                    if (!allowed) {
                      notify.tierLimit('Upgrade to Pro or Premium to use this event type.')
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
                  {typeLabel}
                </button>
              )
            })}
          </div>
        </div>

        {/* Feeding options */}
        {eventType === 'feeding' && (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">Food type</p>
              <div className="flex gap-2 flex-wrap">
                {(['wet', 'dry', 'treats', 'other'] as FoodType[]).map((ft) => (
                  <button key={ft} onClick={() => setFoodType(ft)} className={pillClass(foodType === ft)}>
                    {ft.charAt(0).toUpperCase() + ft.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {foodType !== 'treats' && (
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Amount <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g. 80"
                    value={amountGrams}
                    onChange={(e) => setAmountGrams(e.target.value)}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">grams</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Medication options */}
        {eventType === 'medication' && (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium">Medication name</label>
              <Input
                placeholder="e.g. Prednisolone"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
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
                  value={medDosage}
                  onChange={(e) => setMedDosage(e.target.value)}
                  className="w-28"
                />
                <div className="flex gap-1">
                  {(['mg', 'ml', 'tablet'] as MedUnit[]).map((u) => (
                    <button key={u} onClick={() => setMedUnit(u)} className={pillClass(medUnit === u)}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Grooming options */}
        {eventType === 'grooming' && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Grooming type</p>
            <div className="flex gap-2 flex-wrap">
              {([
                { value: 'bath',       label: 'Bath'       },
                { value: 'nail_trim',  label: 'Nail trim'  },
                { value: 'full_groom', label: 'Full groom' },
                { value: 'other',      label: 'Other'      },
              ] as { value: GroomingType; label: string }[]).map(({ value, label: gl }) => (
                <button key={value} onClick={() => setGroomType(value)} className={pillClass(groomType === value)}>
                  {gl}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Symptom options */}
        {eventType === 'symptom' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">What happened?</p>
              <div className="flex gap-2 flex-wrap">
                {([
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
                ] as { value: SymptomType; label: string }[]).map(({ value, label: sl }) => (
                  <button key={value} onClick={() => setSymptomType(value)} className={pillClass(symptomType === value)}>
                    {sl}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Severity</p>
              <div className="flex gap-2">
                {(['mild', 'moderate', 'severe'] as SymptomSeverity[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSymptomSeverity(s)}
                    className={
                      symptomSeverity === s
                        ? s === 'severe'
                          ? 'px-3 py-1.5 rounded-full text-sm font-medium border bg-red-500 text-white border-red-500 cursor-pointer'
                          : s === 'moderate'
                            ? 'px-3 py-1.5 rounded-full text-sm font-medium border bg-orange-500 text-white border-orange-500 cursor-pointer'
                            : 'px-3 py-1.5 rounded-full text-sm font-medium border bg-yellow-500 text-white border-yellow-500 cursor-pointer'
                        : 'px-3 py-1.5 rounded-full text-sm font-medium border border-border hover:bg-muted/60 cursor-pointer'
                    }
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Default notes */}
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Auto-note <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Textarea
            placeholder="Added automatically to every event logged with this button…"
            value={defaultNotes}
            onChange={(e) => setDefaultNotes(e.target.value)}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        <Button className="w-full" onClick={handleSave} disabled={!canSave}>
          {isEditing ? 'Save changes' : 'Save quick action'}
        </Button>
      </div>
    </div>
  )
}
