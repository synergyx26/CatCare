import { useState } from 'react'
import { X, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { BatchAction } from '@/lib/batchActions'
import type { EventType, SubscriptionTier } from '@/types/api'
import { useAuthStore } from '@/store/authStore'

// Event types that make sense for batch logging (exclude weight/vet_visit
// which require per-cat data that varies per animal)
const BATCH_TYPES: { value: EventType; label: string }[] = [
  { value: 'feeding',    label: 'Feeding'    },
  { value: 'litter',     label: 'Litter'     },
  { value: 'water',      label: 'Water'      },
  { value: 'medication', label: 'Medication' },
  { value: 'grooming',   label: 'Grooming'   },
  { value: 'note',       label: 'Note'       },
]

type FoodType     = 'wet' | 'dry' | 'treats' | 'other'
type GroomingType = 'bath' | 'nail_trim' | 'full_groom' | 'other'
type MedUnit      = 'mg' | 'ml' | 'tablet'

const FREE_BATCH_TYPES: EventType[] = ['feeding', 'litter', 'water', 'note']

function isBatchTypeAllowed(type: EventType, tier: SubscriptionTier): boolean {
  if (tier === 'pro' || tier === 'premium') return true
  return FREE_BATCH_TYPES.includes(type)
}

interface Props {
  onSave: (action: Omit<BatchAction, 'id'>) => void
  onClose: () => void
}

const pillClass = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
    active
      ? 'bg-sky-500 text-white border-sky-500'
      : 'border-border hover:bg-sky-50 dark:hover:bg-sky-950/20'
  }`

export function BatchActionModal({ onSave, onClose }: Props) {
  const { user } = useAuthStore()
  const tier = (user?.subscription_tier ?? 'free') as SubscriptionTier
  const [label,       setLabel]       = useState('')
  const [eventType,   setEventType]   = useState<EventType>('water')
  const [foodType,    setFoodType]    = useState<FoodType>('wet')
  const [amountGrams, setAmountGrams] = useState('')
  const [medName,     setMedName]     = useState('')
  const [medDosage,   setMedDosage]   = useState('')
  const [medUnit,     setMedUnit]     = useState<MedUnit>('mg')
  const [groomType,   setGroomType]   = useState<GroomingType>('bath')

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
    return {}
  }

  const canSave = label.trim() !== '' && (eventType !== 'medication' || medName.trim() !== '')

  function handleSave() {
    if (!canSave) return
    onSave({ label: label.trim(), event_type: eventType, details: buildDetails() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-sm bg-background rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">New quick action</h2>
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
                      toast.error('Upgrade to Pro or Premium to use this event type.')
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

        <Button className="w-full" onClick={handleSave} disabled={!canSave}>
          Save quick action
        </Button>
      </div>
    </div>
  )
}
