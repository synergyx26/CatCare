import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '@/lib/notify'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput, formatPhoneDisplay } from '@/components/ui/phone-input'
import type { Household, MemberRole } from '@/types/api'

interface HouseholdVetSectionProps {
  household: Household
  currentRole: MemberRole | null
}

export function HouseholdVetSection({ household, currentRole }: HouseholdVetSectionProps) {
  const queryClient = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [vetName,    setVetName]    = useState('')
  const [vetClinic,  setVetClinic]  = useState('')
  const [vetPhone,   setVetPhone]   = useState('')
  const [vetAddress, setVetAddress] = useState('')

  const hasVet = !!(household.vet_name || household.vet_clinic)

  const mutation = useMutation({
    mutationFn: () =>
      api.updateHousehold(household.id, {
        household: {
          vet_name:    vetName.trim()    || null,
          vet_clinic:  vetClinic.trim()  || null,
          vet_phone:   vetPhone.trim()   || null,
          vet_address: vetAddress.trim() || null,
        },
      }),
    onSuccess: () => {
      setShowForm(false)
      queryClient.invalidateQueries({ queryKey: ['households'] })
      notify.success('Household vet saved!')
    },
    onError: () => {
      notify.error('Failed to save. Please try again.')
    },
  })

  // Sitters only see this section if a vet is set
  if (!hasVet && currentRole === 'sitter') return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Household vet
        </h2>
        {currentRole !== 'sitter' && !showForm && (
          <button
            onClick={() => {
              setVetName(household.vet_name       ?? '')
              setVetClinic(household.vet_clinic   ?? '')
              setVetPhone(household.vet_phone     ?? '')
              setVetAddress(household.vet_address ?? '')
              setShowForm(true)
            }}
            className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline"
          >
            {hasVet ? 'Edit' : 'Add'}
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
          <p className="text-xs text-muted-foreground">
            Shared across all cats — use "Fill from household vet" when editing individual cats.
          </p>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Vet name</label>
            <Input
              type="text"
              placeholder="Dr. Sarah Kim"
              value={vetName}
              onChange={(e) => setVetName(e.target.value)}
              className="rounded-xl"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Clinic</label>
            <Input
              type="text"
              placeholder="Eastside Animal Hospital"
              value={vetClinic}
              onChange={(e) => setVetClinic(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Phone</label>
            <PhoneInput
              value={vetPhone}
              onChange={setVetPhone}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Address</label>
            <Input
              type="text"
              placeholder="123 Main St, City, State"
              value={vetAddress}
              onChange={(e) => setVetAddress(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (!vetName.trim() && !vetClinic.trim())}
          >
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      ) : hasVet ? (
        <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm px-4 py-3 space-y-0.5">
          {(household.vet_name || household.vet_clinic) && (
            <p className="text-sm font-medium">
              {[household.vet_name, household.vet_clinic].filter(Boolean).join(' · ')}
            </p>
          )}
          {household.vet_phone && (
            <a
              href={`tel:${household.vet_phone}`}
              className="block text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline"
            >
              {formatPhoneDisplay(household.vet_phone)}
            </a>
          )}
          {household.vet_address && (
            <p className="text-xs text-muted-foreground">{household.vet_address}</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-sky-200 dark:border-sky-800/40 bg-sky-50/30 dark:bg-sky-950/10 px-4 py-3">
          <p className="text-xs italic text-muted-foreground">
            No shared vet set — add one so it can be filled into each cat's profile.
          </p>
        </div>
      )}
    </div>
  )
}
