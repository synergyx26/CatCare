import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import type { Household, MemberRole } from '@/types/api'

interface EmergencyContactSectionProps {
  household: Household
  currentRole: MemberRole | null
}

export function EmergencyContactSection({
  household,
  currentRole,
}: EmergencyContactSectionProps) {
  const queryClient = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [ecName, setEcName] = useState('')
  const [ecPhone, setEcPhone] = useState('')

  const ecMutation = useMutation({
    mutationFn: () =>
      api.updateHousehold(household.id, {
        household: {
          emergency_contact_name: ecName.trim() || null,
          emergency_contact_phone: ecPhone.trim() || null,
        },
      }),
    onSuccess: () => {
      setShowForm(false)
      queryClient.invalidateQueries({ queryKey: ['households'] })
      toast.success('Emergency contact saved!')
    },
    onError: () => {
      toast.error('Failed to save. Please try again.')
    },
  })

  if (!household.emergency_contact_name && currentRole === 'sitter') {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Emergency contact
        </h2>
        {currentRole !== 'sitter' && !showForm && (
          <button
            onClick={() => {
              setEcName(household.emergency_contact_name ?? '')
              setEcPhone(household.emergency_contact_phone ?? '')
              setShowForm(true)
            }}
            className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline"
          >
            {household.emergency_contact_name ? 'Edit' : 'Add'}
          </button>
        )}
        {showForm && (
          <button
            onClick={() => setShowForm(false)}
            className="text-xs text-muted-foreground underline"
          >
            Cancel
          </button>
        )}
      </div>

      {showForm ? (
        <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Name</label>
            <Input
              type="text"
              placeholder="Vet clinic, neighbour, etc."
              value={ecName}
              onChange={(e) => setEcName(e.target.value)}
              className="rounded-xl"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Phone</label>
            <PhoneInput
              value={ecPhone}
              onChange={setEcPhone}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => ecMutation.mutate()}
            disabled={ecMutation.isPending || !ecName.trim()}
          >
            {ecMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      ) : household.emergency_contact_name ? (
        <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm px-4 py-3 space-y-0.5">
          <p className="text-sm font-medium">
            {household.emergency_contact_name}
          </p>
          {household.emergency_contact_phone && (
            <a
              href={`tel:${household.emergency_contact_phone}`}
              className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline"
            >
              {household.emergency_contact_phone}
            </a>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-sky-200 dark:border-sky-800/40 bg-sky-50/30 dark:bg-sky-950/10 px-4 py-3">
          <p className="text-xs italic text-muted-foreground">
            No emergency contact set — tap Add so sitters know who to call.
          </p>
        </div>
      )}
    </div>
  )
}
