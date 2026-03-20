import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { CareNotesSection } from '@/components/care-notes/CareNotesSection'
import { ArchiveConfirmDialog } from '@/components/ui/ArchiveConfirmDialog'
import { LogCareModal } from '@/components/LogCareModal'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatTime } from '@/lib/helpers'
import type { Cat, CareEvent, Household, EventType } from '@/types/api'

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
  const [logModal, setLogModal] = useState<{ prefillName?: string; initialEvent?: CareEvent; initialType?: EventType } | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cat', householdId, catId],
    queryFn: () => api.getCat(Number(householdId), Number(catId)),
  })

  const { data: householdData } = useQuery({
    queryKey: ['household', householdId],
    queryFn: () => api.getHousehold(Number(householdId)),
  })

  const { data: careEventsData } = useQuery({
    queryKey: ['care_events', householdId, catId],
    queryFn: () => api.getCareEvents(Number(householdId), Number(catId)),
    enabled: !!householdId && !!catId,
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
      toast.success(archiveDialog === 'deceased' ? 'Rest in peace.' : 'Cat archived.')
      navigate('/dashboard')
    },
    onError: () => toast.error('Something went wrong. Please try again.'),
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

  const hasSitterInfo = !!(cat.care_instructions || cat.vet_name || cat.vet_clinic || cat.vet_phone)

  // Derive active medications from recent care events
  const allCatEvents: CareEvent[] = careEventsData?.data?.data ?? []
  const medicationEvents = allCatEvents
    .filter((e) => e.event_type === 'medication')
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
  // Group by medication name — keep only the most recent entry per name
  const medicationMap = new Map<string, { lastAt: string; dosage: string; unit: string; event: CareEvent }>()
  for (const event of medicationEvents) {
    const d = event.details as Record<string, unknown>
    const name = (d.medication_name as string) || 'Unknown medication'
    if (!medicationMap.has(name)) {
      medicationMap.set(name, {
        lastAt: event.occurred_at,
        dosage: (d.dosage as string) ?? '',
        unit:   (d.unit   as string) ?? '',
        event,
      })
    }
  }
  const medications = Array.from(medicationMap.entries())

  return (
    <div className="mx-auto max-w-sm space-y-6">
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

      {/* Photo + name hero */}
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-gradient-to-b from-sky-50 to-transparent dark:from-sky-950/10 dark:to-transparent p-6">
        {cat.photo_url ? (
          <img
            src={cat.photo_url}
            alt={cat.name}
            className="size-24 rounded-2xl object-cover border-2 border-sky-100 dark:border-sky-900/40 shadow-md"
          />
        ) : (
          <div className="flex size-24 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-100 dark:from-sky-900/30 dark:to-cyan-900/30 text-sky-600 dark:text-sky-400 shadow-md">
            <span className="text-3xl font-bold">{cat.name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <h2 className="text-2xl font-bold">{cat.name}</h2>
        {cat.breed && <p className="text-muted-foreground text-sm">{cat.breed}</p>}
      </div>

      {/* Basic info */}
      <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm overflow-hidden divide-y divide-border/40">
        <Row label="Sex" value={SEX_LABEL[cat.sex] ?? cat.sex} />
        <Row label="Spayed / Neutered" value={cat.sterilized ? 'Yes' : 'No'} />
        {cat.birthday && <Row label="Birthday" value={cat.birthday} />}
        {cat.microchip_number && <Row label="Microchip" value={cat.microchip_number} />}
        {cat.health_notes && <Row label="Health notes" value={cat.health_notes} />}
      </div>

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
                {cat.vet_phone}
              </a>
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
      <div className="rounded-2xl bg-card ring-1 ring-border/60 shadow-sm overflow-hidden">
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              Medications
            </p>
            <button
              onClick={() => setLogModal({})}
              className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
            >
              <Plus className="size-3" />
              Log medication
            </button>
          </div>
          {medications.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">No medications logged yet.</p>
          )}
          {medications.map(([name, { lastAt, dosage, unit, event }]) => (
            <div key={name} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">{name}</p>
                {dosage && (
                  <p className="text-xs text-muted-foreground">
                    {dosage} {unit}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">Last: {formatTime(lastAt)}</span>
                <button
                  onClick={() => setLogModal({ prefillName: name })}
                  className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
                >
                  Log dose
                </button>
                <button
                  onClick={() => setLogModal({ initialEvent: event })}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={`Edit ${name}`}
                >
                  <Pencil className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Care notes */}
      <CareNotesSection
        householdId={Number(householdId)}
        catId={Number(catId)}
        currentRole={currentRole}
      />

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
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-4">
          <button
            onClick={() => {
              const fd = new FormData()
              fd.append('cat[active]', 'true')
              fd.append('cat[deceased]', 'false')
              api.updateCat(Number(householdId), Number(catId), fd).then(() => {
                queryClient.invalidateQueries({ queryKey: ['cats', Number(householdId)] })
                queryClient.invalidateQueries({ queryKey: ['cat', householdId, catId] })
                toast.success(`${cat.name} restored.`)
              })
            }}
            className="text-sm text-sky-600 dark:text-sky-400 hover:underline"
          >
            Restore {cat.name}
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
