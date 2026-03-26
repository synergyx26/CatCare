import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { Cat, Household } from '@/types/api'

export function HouseholdSettingsPage() {
  usePageTitle('Care Settings')
  const { householdId } = useParams<{ householdId: string }>()
  const navigate        = useNavigate()
  const { user }        = useAuthStore()
  const queryClient     = useQueryClient()
  const hid             = Number(householdId)

  const { data: householdsData } = useQuery({
    queryKey: ['households'],
    queryFn:  () => api.getHouseholds(),
  })
  const households: Household[] = householdsData?.data?.data ?? []
  const primaryHousehold = households.find((h) => h.id === hid) ?? households[0]

  // Redirect non-admins
  const currentRole = primaryHousehold?.members?.find((m) => m.id === user?.id)?.role ?? null
  useEffect(() => {
    if (householdsData && currentRole && currentRole !== 'admin') {
      navigate('/dashboard', { replace: true })
    }
  }, [householdsData, currentRole, navigate])

  const { data: catsData, isLoading } = useQuery({
    queryKey: ['cats', hid],
    queryFn:  () => api.getCats(hid),
    enabled:  !!hid,
  })
  const cats: Cat[] = (catsData?.data?.data ?? []).filter((c: Cat) => c.active)

  const mutation = useMutation({
    mutationFn: ({
      catId,
      field,
      value,
    }: {
      catId: number
      field: 'feedings_per_day' | 'track_water' | 'track_litter'
      value: number | boolean
    }) =>
      api.updateCatCareRequirements(hid, catId, { cat: { [field]: value } }),
    onMutate: async ({ catId, field, value }) => {
      // Cancel any in-flight refetches so they don't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey: ['cats', hid] })
      // Snapshot the previous cache value for rollback
      const previousData = queryClient.getQueryData(['cats', hid])
      // Immediately patch the cache so the toggle moves on click
      queryClient.setQueryData(['cats', hid], (old: any) => {
        if (!old?.data?.data) return old
        return {
          ...old,
          data: {
            ...old.data,
            data: old.data.data.map((cat: Cat) =>
              cat.id === catId ? { ...cat, [field]: value } : cat
            ),
          },
        }
      })
      return { previousData }
    },
    onError: (_err, _vars, context) => {
      // Roll back to the snapshot if the mutation fails
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(['cats', hid], context.previousData)
      }
      toast.error('Failed to save. Please try again.')
    },
    onSettled: () => {
      // Always sync with the server after mutation resolves
      queryClient.invalidateQueries({ queryKey: ['cats', hid] })
    },
  })

  function handleChange(
    catId: number,
    field: 'feedings_per_day' | 'track_water' | 'track_litter',
    value: number | boolean
  ) {
    mutation.mutate({ catId, field, value })
  }

  if (isLoading || !householdsData) {
    return <PageSkeleton />
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Care Settings"
        subtitle="Configure daily care requirements for each cat"
        backTo={{ label: 'Back to dashboard', onClick: () => navigate('/dashboard') }}
      />

      {/* Info callout */}
      <div className="rounded-2xl bg-sky-50 dark:bg-sky-950/20 ring-1 ring-sky-200/60 dark:ring-sky-800/30 p-4">
        <p className="text-sm text-sky-700 dark:text-sky-300">
          These settings control which status badges appear on the dashboard and what counts as
          "needs attention" for each cat. Changes take effect immediately.
        </p>
      </div>

      {cats.length === 0 ? (
        <div className="rounded-2xl bg-card ring-1 ring-border/60 p-8 text-center text-sm text-muted-foreground">
          No active cats yet.
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Daily requirements per cat
          </h2>
          <div className="rounded-2xl bg-card ring-1 ring-border/60 divide-y divide-border/40 overflow-hidden">
            {cats.map((cat) => (
              <CatCareRow
                key={cat.id}
                cat={cat}
                onChange={handleChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface CatCareRowProps {
  cat: Cat
  onChange: (
    catId: number,
    field: 'feedings_per_day' | 'track_water' | 'track_litter',
    value: number | boolean
  ) => void
}

function CatCareRow({ cat, onChange }: CatCareRowProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 flex-wrap sm:flex-nowrap">
      {/* Cat avatar + name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {cat.photo_url ? (
          <img
            src={cat.photo_url}
            alt={cat.name}
            className="size-9 shrink-0 rounded-xl border border-border/40 object-cover"
          />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-sm font-bold">
            {cat.name.charAt(0).toUpperCase()}
          </div>
        )}
        <p className="font-medium text-sm truncate">{cat.name}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap shrink-0">
        {/* Feedings per day */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">🍽️ Feedings/day</span>
          <select
            value={cat.feedings_per_day}
            onChange={(e) => onChange(cat.id, 'feedings_per_day', Number(e.target.value))}
            className="h-8 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}×</option>
            ))}
          </select>
        </div>

        {/* Track water toggle */}
        <TrackToggle
          emoji="💧"
          label="Water"
          checked={cat.track_water}
          onChange={(v) => onChange(cat.id, 'track_water', v)}
        />

        {/* Track litter toggle */}
        <TrackToggle
          emoji="🧹"
          label="Litter"
          checked={cat.track_litter}
          onChange={(v) => onChange(cat.id, 'track_litter', v)}
        />
      </div>
    </div>
  )
}

function TrackToggle({
  emoji,
  label,
  checked,
  onChange,
}: {
  emoji: string
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        checked
          ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
          : 'bg-muted text-muted-foreground ring-1 ring-border/60 hover:bg-muted/80'
      }`}
      aria-pressed={checked}
      aria-label={`${checked ? 'Disable' : 'Enable'} ${label} tracking`}
    >
      {emoji} {label}
      <span className="ml-0.5 text-[10px] font-semibold opacity-60">
        {checked ? 'ON' : 'OFF'}
      </span>
    </button>
  )
}
