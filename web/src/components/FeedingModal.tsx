import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Cat } from '@/types/api'

type FoodType = 'wet' | 'dry' | 'treats' | 'other'

const FOOD_TYPES: { value: FoodType; label: string }[] = [
  { value: 'wet',    label: 'Wet' },
  { value: 'dry',    label: 'Dry' },
  { value: 'treats', label: 'Treats' },
  { value: 'other',  label: 'Other' },
]

const PRESETS: Record<FoodType, number[]> = {
  wet:    [50, 60, 70, 80],
  dry:    [80, 90, 100],
  treats: [],
  other:  [],
}

function toLocalDateTimeInput(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`
}

interface Props {
  cat: Cat
  householdId: number
  onClose: () => void
}

export function FeedingModal({ cat, householdId, onClose }: Props) {
  const queryClient = useQueryClient()
  const [foodType, setFoodType]           = useState<FoodType>('wet')
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [isCustom, setIsCustom]           = useState(false)
  const [customAmount, setCustomAmount]   = useState('')
  const [notes, setNotes]                 = useState('')
  const [occurredAt, setOccurredAt]       = useState(toLocalDateTimeInput(new Date()))

  const presets = PRESETS[foodType]

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

  const parsedCustom = parseFloat(customAmount)
  const effectiveAmount = isCustom ? parsedCustom : selectedAmount
  const canSubmit =
    foodType === 'treats' || foodType === 'other'
      ? true
      : selectedAmount != null || (isCustom && customAmount !== '' && !isNaN(parsedCustom))

  const mutation = useMutation({
    mutationFn: () =>
      api.createCareEvent(householdId, {
        care_event: {
          cat_id:      cat.id,
          event_type:  'feeding',
          occurred_at: new Date(occurredAt).toISOString(),
          notes:       notes.trim() || null,
          details: {
            food_type: foodType,
            ...(effectiveAmount != null && !isNaN(effectiveAmount)
              ? { amount_grams: effectiveAmount }
              : {}),
          },
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care_events', householdId] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div className="relative z-10 w-full sm:max-w-sm bg-background rounded-t-2xl sm:rounded-2xl p-6 space-y-5 shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Log feeding — {cat.name}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Food type pills */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Food type</p>
          <div className="flex gap-2 flex-wrap">
            {FOOD_TYPES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => pickFoodType(value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  foodType === value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount pills — shown for wet, dry, and other (not treats) */}
        {foodType !== 'treats' && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Amount</p>
            <div className="flex gap-2 flex-wrap">
              {presets.map((g) => (
                <button
                  key={g}
                  onClick={() => pickPreset(g)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    !isCustom && selectedAmount === g
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {g}g
                </button>
              ))}
              <button
                onClick={() => { setIsCustom(true); setSelectedAmount(null) }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  isCustom
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                Custom
              </button>
            </div>

            {isCustom && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 75"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="input w-28"
                  autoFocus
                />
                <span className="text-sm text-muted-foreground">grams</span>
              </div>
            )}
          </div>
        )}

        {/* Date & time */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Date & time</label>
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="input"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Notes{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. ate slowly, left some food…"
            rows={2}
            className="input resize-none"
          />
        </div>

        {mutation.isError && (
          <p className="text-destructive text-sm">Failed to log. Please try again.</p>
        )}

        <button
          onClick={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
          className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium disabled:opacity-40 transition-opacity"
        >
          {mutation.isPending ? 'Logging…' : 'Log feeding'}
        </button>
      </div>
    </div>
  )
}
