import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plane, Pencil, Trash2, X } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { usePageTitle } from '@/hooks/usePageTitle'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui/button'
import type { Household, VacationTrip } from '@/types/api'

// ─── Schema ───────────────────────────────────────────────────────────────────

const tripSchema = z
  .object({
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().optional().nullable(),
    sitter_visit_frequency_days: z
      .number()
      .int()
      .min(1, 'Minimum 1 day')
      .max(30, 'Maximum 30 days'),
    notes: z.string().optional().nullable(),
  })
  .refine(
    (d) => !d.end_date || !d.start_date || d.end_date >= d.start_date,
    { message: 'End date must be on or after start date', path: ['end_date'] }
  )

type TripFormValues = z.infer<typeof tripSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Trip form ────────────────────────────────────────────────────────────────

interface TripFormProps {
  defaultValues: TripFormValues
  onSubmit: (values: TripFormValues) => void
  onCancel?: () => void
  isPending: boolean
  submitLabel: string
}

function TripForm({ defaultValues, onSubmit, onCancel, isPending, submitLabel }: TripFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripSchema) as any,
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Start date <span className="text-destructive">*</span></label>
          <input
            type="date"
            {...register('start_date')}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.start_date && (
            <p className="text-xs text-destructive">{errors.start_date.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">End date <span className="text-xs text-muted-foreground">(optional)</span></label>
          <input
            type="date"
            {...register('end_date')}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.end_date && (
            <p className="text-xs text-destructive">{errors.end_date.message}</p>
          )}
          <p className="text-xs text-muted-foreground">Leave blank for an open-ended trip</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Sitter visits every <span className="text-destructive">*</span></label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={30}
            {...register('sitter_visit_frequency_days', { valueAsNumber: true })}
            className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm text-muted-foreground">day(s)</span>
        </div>
        {errors.sitter_visit_frequency_days && (
          <p className="text-xs text-destructive">{errors.sitter_visit_frequency_days.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Care status badges will check the last N days instead of just today
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notes <span className="text-xs text-muted-foreground">(optional)</span></label>
        <textarea
          {...register('notes')}
          rows={2}
          placeholder="e.g. Keys are under the mat, emergency contact is Dr. Smith"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function VacationModePage() {
  usePageTitle('Vacation Mode')
  const { householdId } = useParams<{ householdId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const hid = Number(householdId)

  const [editingTrip, setEditingTrip] = useState<VacationTrip | null>(null)

  const { data: householdsData, isLoading: householdsLoading } = useQuery({
    queryKey: ['households'],
    queryFn: () => api.getHouseholds(),
  })
  const households: Household[] = householdsData?.data?.data ?? []
  const primaryHousehold = households.find((h) => h.id === hid) ?? households[0]
  const currentRole = primaryHousehold?.members?.find((m) => m.id === user?.id)?.role ?? null

  // Redirect non-admins
  useEffect(() => {
    if (householdsData && currentRole && currentRole !== 'admin') {
      navigate(`/households/${hid}`, { replace: true })
    }
  }, [householdsData, currentRole, navigate, hid])

  const { data: tripsData, isLoading: tripsLoading } = useQuery({
    queryKey: ['vacation_trips', hid],
    queryFn: () => api.getVacationTrips(hid),
    enabled: !!hid,
    select: (res) => res.data.data as VacationTrip[],
  })
  const trips: VacationTrip[] = tripsData ?? []
  const activeTrip = trips.find((t) => t.active) ?? null
  const pastTrips = trips.filter((t) => !t.active)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['vacation_trips', hid] })
    queryClient.invalidateQueries({ queryKey: ['households'] })
  }

  const createMutation = useMutation({
    mutationFn: (values: TripFormValues) =>
      api.createVacationTrip(hid, {
        vacation_trip: {
          start_date: values.start_date,
          end_date: values.end_date || null,
          notes: values.notes || null,
          sitter_visit_frequency_days: values.sitter_visit_frequency_days,
        },
      }),
    onSuccess: () => {
      notify.success('Vacation trip started.')
      invalidate()
    },
    onError: () => notify.error('Failed to create trip. Please try again.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: TripFormValues }) =>
      api.updateVacationTrip(hid, id, {
        vacation_trip: {
          start_date: values.start_date,
          end_date: values.end_date || null,
          notes: values.notes || null,
          sitter_visit_frequency_days: values.sitter_visit_frequency_days,
        },
      }),
    onSuccess: () => {
      notify.success('Trip updated.')
      setEditingTrip(null)
      invalidate()
    },
    onError: () => notify.error('Failed to update trip.'),
  })

  const endMutation = useMutation({
    mutationFn: (id: number) =>
      api.updateVacationTrip(hid, id, { vacation_trip: { active: false, end_date: todayStr() } }),
    onSuccess: () => {
      notify.success('Trip ended.')
      invalidate()
    },
    onError: () => notify.error('Failed to end trip.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteVacationTrip(hid, id),
    onSuccess: () => {
      notify.success('Trip deleted.')
      invalidate()
    },
    onError: () => notify.error('Failed to delete trip.'),
  })

  if (householdsLoading || tripsLoading) return <PageSkeleton />

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <PageHeader
        title="Vacation Mode"
        subtitle="Let the household know you're away and how often the sitter visits."
        backTo={{ label: 'Dashboard', onClick: () => navigate('/dashboard') }}
      />

      {/* ── Active trip ─────────────────────────────────────────── */}
      {activeTrip && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Plane className="size-4 text-sky-600 dark:text-sky-400" />
            <h2 className="text-base font-semibold">Active Trip</h2>
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
              active
            </span>
          </div>

          {editingTrip?.id === activeTrip.id ? (
            <div className="rounded-xl border border-border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Edit trip</p>
                <button
                  onClick={() => setEditingTrip(null)}
                  className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <TripForm
                defaultValues={{
                  start_date: activeTrip.start_date,
                  end_date: activeTrip.end_date ?? '',
                  sitter_visit_frequency_days: activeTrip.sitter_visit_frequency_days,
                  notes: activeTrip.notes ?? '',
                }}
                onSubmit={(values) => updateMutation.mutate({ id: activeTrip.id, values })}
                onCancel={() => setEditingTrip(null)}
                isPending={updateMutation.isPending}
                submitLabel="Save changes"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-sky-200 dark:border-sky-800/30 bg-sky-50/60 dark:bg-sky-950/10 p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Start</p>
                  <p className="font-medium">{formatDate(activeTrip.start_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">End</p>
                  <p className="font-medium">
                    {activeTrip.end_date ? formatDate(activeTrip.end_date) : 'Open-ended'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sitter visits every</p>
                  <p className="font-medium">
                    {activeTrip.sitter_visit_frequency_days} day{activeTrip.sitter_visit_frequency_days !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              {activeTrip.notes && (
                <p className="text-sm text-muted-foreground italic">{activeTrip.notes}</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTrip(activeTrip)}
                >
                  <Pencil className="size-3.5 mr-1.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => endMutation.mutate(activeTrip.id)}
                  disabled={endMutation.isPending}
                >
                  End trip
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── New trip form (hidden when active trip exists) ────────── */}
      {!activeTrip && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Plane className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Start a New Trip</h2>
          </div>
          <div className="rounded-xl border border-border p-4">
            <TripForm
              defaultValues={{
                start_date: todayStr(),
                end_date: '',
                sitter_visit_frequency_days: 2,
                notes: '',
              }}
              onSubmit={(values) => createMutation.mutate(values)}
              isPending={createMutation.isPending}
              submitLabel="Start trip"
            />
          </div>
        </section>
      )}

      {/* ── Past trips ───────────────────────────────────────────── */}
      {pastTrips.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-muted-foreground">Past Trips</h2>
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {pastTrips.map((trip) => (
              <div key={trip.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {formatDate(trip.start_date)}
                    {trip.end_date ? ` – ${formatDate(trip.end_date)}` : ' – ongoing'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Sitter every {trip.sitter_visit_frequency_days}d
                    {trip.notes ? ` · ${trip.notes}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(trip.id)}
                  disabled={deleteMutation.isPending}
                  className="shrink-0 flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40"
                  aria-label="Delete trip"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
