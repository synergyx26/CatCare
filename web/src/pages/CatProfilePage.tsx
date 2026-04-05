import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useParams, useNavigate } from 'react-router-dom'
import { notify } from '@/lib/notify'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { CareNotesSection } from '@/components/care-notes/CareNotesSection'
import { MedicationsSection } from '@/components/medications/MedicationsSection'
import { RemindersSection } from '@/components/reminders/RemindersSection'
import { ArchiveConfirmDialog } from '@/components/ui/ArchiveConfirmDialog'
import { LogCareModal } from '@/components/LogCareModal'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatPhoneDisplay } from '@/components/ui/phone-input'
import { isCatBirthday, getCatAge } from '@/lib/helpers'
import type { Cat, CareEvent, Household, EventType, ApiError } from '@/types/api'
// CareEvent imported for LogCareModal's initialEvent prop type (used in onOpenModal callback)

const SEX_LABEL: Record<string, string> = {
  unknown: 'Unknown',
  male: 'Male',
  female: 'Female',
}

export function CatProfilePage() {
  const { householdId, catId } = useParams<{ householdId: string; catId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [archiveDialog, setArchiveDialog] = useState<'archive' | 'deceased' | null>(null)
  const [logModal, setLogModal] = useState<{ prefillName?: string; initialEvent?: CareEvent; initialType?: EventType; activeMedication?: boolean } | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cat', householdId, catId],
    queryFn: () => api.getCat(Number(householdId), Number(catId)),
  })

  const { data: householdData } = useQuery({
    queryKey: ['household', householdId],
    queryFn: () => api.getHousehold(Number(householdId)),
  })

  const { data: upcomingVetData } = useQuery({
    queryKey: ['upcoming_appointments', householdId, catId],
    queryFn: () => api.getCareEvents(Number(householdId), {
      catId: Number(catId),
      upcoming: true,
      eventTypes: ['vet_visit'],
    }),
    enabled: !!householdId && !!catId,
    staleTime: 60_000,
  })
  const nextVetVisit: CareEvent | null = (upcomingVetData?.data?.data ?? [])[0] ?? null

  const restoreMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('cat[active]', 'true')
      fd.append('cat[deceased]', 'false')
      return api.updateCat(Number(householdId), Number(catId), fd)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cats', Number(householdId)] })
      queryClient.invalidateQueries({ queryKey: ['cat', householdId, catId] })
      notify.success('Cat restored.')
      navigate('/dashboard')
    },
    onError: (err: AxiosError<ApiError>) => {
      if (err.response?.data?.error === 'TIER_LIMIT') {
        notify.tierLimit('Cat limit reached for your plan. Upgrade to restore this cat.')
      } else {
        notify.error('Something went wrong. Please try again.')
      }
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (payload: { active: boolean; deceased: boolean }) => {
      const fd = new FormData()
      fd.append('cat[active]', String(payload.active))
      fd.append('cat[deceased]', String(payload.deceased))
      return api.updateCat(Number(householdId), Number(catId), fd)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cats', Number(householdId)] })
      queryClient.invalidateQueries({ queryKey: ['cat', householdId, catId] })
      notify.success(archiveDialog === 'deceased' ? 'Rest in peace.' : 'Cat archived.')
      navigate('/dashboard')
    },
    onError: () => notify.error('Something went wrong. Please try again.'),
  })

  usePageTitle((data?.data?.data as Cat | undefined)?.name ?? '')

  if (isLoading) {
    return <PageSkeleton />
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-destructive text-sm">Failed to load cat profile.</p>
      </div>
    )
  }

  const cat: Cat = data.data.data
  const household: Household | undefined = householdData?.data?.data
  const currentRole = household?.members.find((m) => m.id === user?.id)?.role ?? null
  const isSitter = currentRole === 'sitter'
  const isBirthday = isCatBirthday(cat.birthday)
  const catAge = getCatAge(cat.birthday)
  const birthdayLabel =
    catAge === 0
      ? 'First birthday!'
      : catAge !== null
        ? `Turning ${catAge} today`
        : 'Happy Birthday!'

  const hasSitterInfo = !!(cat.care_instructions || cat.vet_name || cat.vet_clinic || cat.vet_phone)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={cat.name}
        backTo={{
          label: 'Back to dashboard',
          onClick: () => navigate('/dashboard'),
        }}
        action={
          <div className="flex items-center gap-2">
            {!isSitter && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/households/${householdId}/cats/${catId}/edit`)}
              >
                Edit profile
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/households/${householdId}/cats/${catId}/history`)}
            >
              View history
            </Button>
          </div>
        }
      />

      {/* Two-column layout on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">

        {/* ── Left column: photo hero + basic info ────────────── */}
        <div className="space-y-6">
          {/* Photo + name hero */}
          <div
            className={`flex flex-col items-center gap-3 rounded-2xl p-6 ${
              isBirthday
                ? 'bg-gradient-to-b from-rose-50 via-pink-50/60 to-transparent dark:from-rose-950/25 dark:via-pink-950/15 dark:to-transparent'
                : 'bg-gradient-to-b from-sky-50 to-transparent dark:from-sky-950/10 dark:to-transparent'
            }`}
          >
            <div className="relative">
              {cat.photo_url ? (
                <img
                  src={cat.photo_url}
                  alt={cat.name}
                  className={`size-24 rounded-2xl object-cover shadow-md ${
                    isBirthday
                      ? 'border-2 border-rose-200 dark:border-rose-800/40 ring-4 ring-rose-300/50 dark:ring-rose-700/40'
                      : 'border-2 border-sky-100 dark:border-sky-900/40'
                  }`}
                />
              ) : (
                <div
                  className={`flex size-24 items-center justify-center rounded-2xl shadow-md ${
                    isBirthday
                      ? 'bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30 text-rose-600 dark:text-rose-400 ring-4 ring-rose-300/50 dark:ring-rose-700/40'
                      : 'bg-gradient-to-br from-sky-100 to-cyan-100 dark:from-sky-900/30 dark:to-cyan-900/30 text-sky-600 dark:text-sky-400'
                  }`}
                >
                  <span className="text-3xl font-bold">{cat.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
              {isBirthday && (
                <span
                  aria-hidden="true"
                  className="absolute -top-4 -right-4 text-3xl drop-shadow-sm pointer-events-none select-none"
                >
                  🎂
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold">{cat.name}</h2>
            {isBirthday && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-100 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800/30">
                <span aria-hidden="true" className="text-sm leading-none">🎉</span>
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {birthdayLabel}
                </span>
              </div>
            )}
            {cat.breed && <p className="text-muted-foreground text-sm">{cat.breed}</p>}
          </div>

          {/* Basic info */}
          <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm overflow-hidden divide-y divide-border/40">
            <Row label="Sex" value={SEX_LABEL[cat.sex] ?? cat.sex} />
            <Row label="Spayed / Neutered" value={cat.sterilized ? 'Yes' : 'No'} />
            {cat.birthday && <Row label="Birthday" value={cat.birthday} />}
            {cat.microchip_number && <Row label="Microchip" value={cat.microchip_number} />}
            {cat.health_notes && <Row label="Health notes" value={cat.health_notes} />}
            {cat.health_conditions.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground mb-2">Known conditions</p>
                <div className="flex flex-wrap gap-1.5">
                  {cat.health_conditions.map((condition) => (
                    <span
                      key={condition}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                    >
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: sitter info + medications + notes ─── */}
        <div className="space-y-6">
          {/* Sitter info */}
          {hasSitterInfo && (
            <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm overflow-hidden divide-y divide-border/40">
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider mb-2">
                  Sitter info
                </p>
                {cat.care_instructions && (
                  <p className="text-sm whitespace-pre-wrap">{cat.care_instructions}</p>
                )}
              </div>
              {cat.vet_name && (
                <Row
                  label="Vet"
                  value={[cat.vet_name, cat.vet_clinic].filter(Boolean).join(' · ')}
                />
              )}
              {cat.vet_phone && (
                <div className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Vet phone</span>
                  <a href={`tel:${cat.vet_phone}`} className="font-medium text-sky-600 dark:text-sky-400 hover:underline">
                    {formatPhoneDisplay(cat.vet_phone)}
                  </a>
                </div>
              )}
              {cat.vet_address && (
                <Row label="Vet address" value={cat.vet_address} />
              )}
              {nextVetVisit && (
                <div className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Next visit</span>
                  <span className="font-medium text-right max-w-[60%]">
                    {new Date(nextVetVisit.occurred_at).toLocaleDateString([], {
                      weekday: 'short', month: 'short', day: 'numeric',
                    })}
                    {(nextVetVisit.details as Record<string, unknown>).reason
                      ? ` · ${(nextVetVisit.details as Record<string, unknown>).reason}`
                      : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Prompt owner to fill in sitter info */}
          {!hasSitterInfo && !isSitter && (
            <div className="rounded-2xl border border-dashed border-sky-200 dark:border-sky-800/40 bg-sky-50/30 dark:bg-sky-950/10 px-4 py-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground">No sitter info yet.</p>
              <button
                onClick={() => navigate(`/households/${householdId}/cats/${catId}/edit`)}
                className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline"
              >
                Add vet contact &amp; care instructions
              </button>
            </div>
          )}

          {/* Medications */}
          <MedicationsSection
            householdId={Number(householdId)}
            catId={Number(catId)}
            currentRole={currentRole}
            onOpenModal={(opts) => setLogModal({
              initialEvent:     opts.initialEvent,
              prefillName:      opts.prefillName,
              activeMedication: true,
            })}
          />

          {/* Care notes */}
          <CareNotesSection
            householdId={Number(householdId)}
            catId={Number(catId)}
            currentRole={currentRole}
          />

          {/* Reminders */}
          <RemindersSection
            householdId={Number(householdId)}
            catId={Number(catId)}
            currentRole={currentRole}
          />
        </div>
      </div>

      {/* Archive / deceased — non-sitter members only, active cats only */}
      {!isSitter && cat.active && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Manage
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setArchiveDialog('archive')}
              className="text-left text-sm text-amber-600 dark:text-amber-400 hover:underline"
            >
              Archive {cat.name}
            </button>
            <button
              onClick={() => setArchiveDialog('deceased')}
              className="text-left text-sm text-destructive hover:underline"
            >
              Mark as deceased
            </button>
          </div>
        </div>
      )}

      {/* Restore — for archived/deceased cats */}
      {!isSitter && !cat.active && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Manage
          </p>
          <button
            onClick={() => restoreMutation.mutate()}
            disabled={restoreMutation.isPending}
            className="text-left text-sm text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-50"
          >
            {restoreMutation.isPending ? 'Restoring…' : `Restore ${cat.name}`}
          </button>
        </div>
      )}

      {logModal && (
        <LogCareModal
          cat={cat}
          householdId={Number(householdId)}
          initialEvent={logModal.initialEvent}
          initialType={logModal.initialEvent ? undefined : 'medication'}
          initialMedicationName={logModal.prefillName}
          activeMedication={logModal.activeMedication}
          onClose={() => setLogModal(null)}
        />
      )}

      {archiveDialog && (
        <ArchiveConfirmDialog
          open={!!archiveDialog}
          onOpenChange={(open) => { if (!open) setArchiveDialog(null) }}
          variant={archiveDialog}
          catName={cat.name}
          onConfirm={() =>
            archiveMutation.mutate({
              active: false,
              deceased: archiveDialog === 'deceased',
            })
          }
          isPending={archiveMutation.isPending}
        />
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value}</span>
    </div>
  )
}
