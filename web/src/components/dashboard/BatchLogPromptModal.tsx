import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { HouseholdBatchAction } from '@/types/api'

interface Props {
  /** The quick action being fired; its details carry the *_variable markers
   *  (amount_grams_variable, notes_variable — see BatchActionModal) that
   *  decide what this prompts for. */
  action: HouseholdBatchAction
  /** Names of every cat this action will log for. */
  catNames: string[]
  onConfirm: (amountGrams: number | null, notes?: string) => void
  onClose: () => void
}

/**
 * Shown before firing a "Log for all" quick action whose amount and/or note
 * varies each time (e.g. an "Other" food preset with no fixed portion, or
 * any preset marked "ask when logging" for its note). Confirms which cats
 * will be logged and collects whichever pieces this preset left blank —
 * a preset with both markers set shows the note field already open, right
 * below the amount.
 */
export function BatchLogPromptModal({ action, catNames, onConfirm, onClose }: Props) {
  const needsAmount = action.event_type === 'feeding' && action.details.amount_grams_variable === true
  const notesRequested = action.details.notes_variable === true

  const [amount, setAmount] = useState('')
  const [showNotes, setShowNotes] = useState(notesRequested)
  const [notes, setNotes] = useState('')

  const parsed = parseFloat(amount)
  const canConfirm = !needsAmount || (amount.trim() !== '' && !isNaN(parsed) && parsed > 0)

  function handleConfirm() {
    if (!canConfirm) return
    onConfirm(needsAmount ? parsed : null, showNotes ? notes.trim() || undefined : undefined)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-sm bg-background rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">{action.label}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Will log for <span className="font-medium text-foreground">{catNames.join(', ')}</span>.{' '}
          {needsAmount
            ? "This preset's amount varies — enter today's amount to continue."
            : "This preset asks for a note each time it's used."}
        </p>

        {needsAmount && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Amount</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                placeholder="e.g. 45"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
                className="w-28"
                autoFocus
              />
              <span className="text-sm text-muted-foreground">grams</span>
            </div>
          </div>
        )}

        {showNotes ? (
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Note <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. tried the salmon pouches, half a can..."
              rows={2}
              className="resize-none text-sm"
              autoFocus={!needsAmount}
            />
            {!notesRequested && (
              <button
                type="button"
                onClick={() => { setShowNotes(false); setNotes('') }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Remove note
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="text-sm font-medium text-primary hover:underline"
          >
            + Add a note
          </button>
        )}

        <Button className="w-full" onClick={handleConfirm} disabled={!canConfirm}>
          Log for {catNames.length} cat{catNames.length === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  )
}
