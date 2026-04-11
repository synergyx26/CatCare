import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notify } from '@/lib/notify'
import { Plus, X } from 'lucide-react'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { CURRENCIES } from '@/lib/currency'
import type { Cat, Household } from '@/types/api'

// ─── Country list for phone defaults ─────────────────────────────────────────

const COUNTRIES: { code: string; label: string }[] = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'IE', label: 'Ireland' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'ES', label: 'Spain' },
  { code: 'IT', label: 'Italy' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'BE', label: 'Belgium' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'AT', label: 'Austria' },
  { code: 'SE', label: 'Sweden' },
  { code: 'NO', label: 'Norway' },
  { code: 'DK', label: 'Denmark' },
  { code: 'FI', label: 'Finland' },
  { code: 'PL', label: 'Poland' },
  { code: 'PT', label: 'Portugal' },
  { code: 'CZ', label: 'Czech Republic' },
  { code: 'HU', label: 'Hungary' },
  { code: 'RO', label: 'Romania' },
  { code: 'GR', label: 'Greece' },
  { code: 'JP', label: 'Japan' },
  { code: 'CN', label: 'China' },
  { code: 'KR', label: 'South Korea' },
  { code: 'IN', label: 'India' },
  { code: 'SG', label: 'Singapore' },
  { code: 'HK', label: 'Hong Kong' },
  { code: 'TW', label: 'Taiwan' },
  { code: 'TH', label: 'Thailand' },
  { code: 'PH', label: 'Philippines' },
  { code: 'MY', label: 'Malaysia' },
  { code: 'ID', label: 'Indonesia' },
  { code: 'BR', label: 'Brazil' },
  { code: 'MX', label: 'Mexico' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CL', label: 'Chile' },
  { code: 'CO', label: 'Colombia' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'IL', label: 'Israel' },
  { code: 'TR', label: 'Turkey' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type FoodKey = 'wet' | 'dry' | 'treats' | 'other'

type CatCareField = 'feedings_per_day' | 'track_water' | 'track_litter' | 'track_toothbrushing'

const FOOD_LABELS: Record<FoodKey, string> = {
  wet:    'Wet',
  dry:    'Dry',
  treats: 'Treats',
  other:  'Other',
}

// Food types that support portion amounts (treats + other are quantity-free)
const PORTIONED_FOOD_KEYS: FoodKey[] = ['wet', 'dry']

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  // ── Locale state (currency + country) ───────────────────────────────────────

  const [currency, setCurrency] = useState(primaryHousehold?.currency ?? 'USD')
  const [defaultCountry, setDefaultCountry] = useState(primaryHousehold?.default_country ?? 'US')

  useEffect(() => {
    if (primaryHousehold) {
      setCurrency(primaryHousehold.currency ?? 'USD')
      setDefaultCountry(primaryHousehold.default_country ?? 'US')
    }
  }, [primaryHousehold?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const localeMutation = useMutation({
    mutationFn: () =>
      api.updateHousehold(hid, { household: { currency, default_country: defaultCountry } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] })
      notify.success('Locale settings saved')
    },
    onError: () => notify.error('Failed to save locale settings'),
  })

  const localeChanged =
    currency !== (primaryHousehold?.currency ?? 'USD') ||
    defaultCountry !== (primaryHousehold?.default_country ?? 'US')

  // ── Mutation: patch any cat field(s) ────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: ({
      catId,
      patch,
    }: {
      catId: number
      patch: Parameters<typeof api.updateCatCareRequirements>[2]['cat']
    }) => api.updateCatCareRequirements(hid, catId, { cat: patch }),

    onMutate: async ({ catId, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['cats', hid] })
      const previousData = queryClient.getQueryData(['cats', hid])
      queryClient.setQueryData(['cats', hid], (old: any) => {
        if (!old?.data?.data) return old
        return {
          ...old,
          data: {
            ...old.data,
            data: old.data.data.map((cat: Cat) =>
              cat.id === catId ? { ...cat, ...patch } : cat
            ),
          },
        }
      })
      return { previousData }
    },

    onError: (_err, _vars, context) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(['cats', hid], context.previousData)
      }
      notify.error('Failed to save. Please try again.')
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cats', hid] })
    },
  })

  function handleFieldChange(catId: number, field: CatCareField, value: number | boolean) {
    mutation.mutate({ catId, patch: { [field]: value } })
  }

  function handlePresetsChange(
    catId: number,
    cat: Cat,
    foodKey: FoodKey,
    newAmounts: number[]
  ) {
    mutation.mutate({
      catId,
      patch: {
        feeding_presets: {
          ...cat.feeding_presets,
          [foodKey]: newAmounts,
        },
      },
    })
  }

  if (isLoading || !householdsData) {
    return <PageSkeleton />
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Care Settings"
        subtitle="Configure daily care requirements and feeding portions for each cat"
        backTo={{ label: 'Back to dashboard', onClick: () => navigate('/dashboard') }}
      />

      {/* ── Locale settings ── */}
      <div className="rounded-2xl bg-card ring-1 ring-border/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40">
          <p className="text-sm font-semibold">Locale settings</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sets the currency shown in Expenses and the default country code in phone fields.
          </p>
        </div>
        <div className="px-4 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground block">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.code} — {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground block">Default phone country</label>
              <select
                value={defaultCountry}
                onChange={(e) => setDefaultCountry(e.target.value)}
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => localeMutation.mutate()}
              disabled={!localeChanged || localeMutation.isPending}
            >
              {localeMutation.isPending ? 'Saving…' : 'Save locale'}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-sky-50 dark:bg-sky-950/20 ring-1 ring-sky-200/60 dark:ring-sky-800/30 p-4">
        <p className="text-sm text-sky-700 dark:text-sky-300">
          Dashboard badges and "needs attention" counts respect these settings. Portion presets
          appear as quick-pick buttons when logging a feeding. Changes take effect immediately.
        </p>
      </div>

      {cats.length === 0 ? (
        <div className="rounded-2xl bg-card ring-1 ring-border/60 p-8 text-center text-sm text-muted-foreground">
          No active cats yet.
        </div>
      ) : (
        <div className="space-y-4">
          {cats.map((cat) => (
            <CatCareCard
              key={cat.id}
              cat={cat}
              onFieldChange={handleFieldChange}
              onPresetsChange={handlePresetsChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Per-cat card ─────────────────────────────────────────────────────────────

interface CatCareCardProps {
  cat: Cat
  onFieldChange: (catId: number, field: CatCareField, value: number | boolean) => void
  onPresetsChange: (catId: number, cat: Cat, foodKey: FoodKey, amounts: number[]) => void
}

function CatCareCard({ cat, onFieldChange, onPresetsChange }: CatCareCardProps) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border/60 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
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
        <p className="font-semibold text-sm">{cat.name}</p>
      </div>

      <div className="divide-y divide-border/30">
        {/* Daily tracking toggles */}
        <div className="px-4 py-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Daily tracking
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            {/* Feedings per day */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">🍽️ Feedings/day</span>
              <select
                value={cat.feedings_per_day}
                onChange={(e) => onFieldChange(cat.id, 'feedings_per_day', Number(e.target.value))}
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}×</option>
                ))}
              </select>
            </div>

            <TrackToggle
              emoji="💧"
              label="Water"
              checked={cat.track_water}
              onChange={(v) => onFieldChange(cat.id, 'track_water', v)}
            />

            <TrackToggle
              emoji="🧹"
              label="Litter"
              checked={cat.track_litter}
              onChange={(v) => onFieldChange(cat.id, 'track_litter', v)}
            />

            <TrackToggle
              emoji="🦷"
              label="Teeth"
              checked={cat.track_toothbrushing}
              onChange={(v) => onFieldChange(cat.id, 'track_toothbrushing', v)}
            />
          </div>
        </div>

        {/* Portion presets */}
        <div className="px-4 py-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Portion presets (grams)
          </p>
          <p className="text-xs text-muted-foreground -mt-1">
            These appear as quick-pick buttons in the feeding log.
          </p>
          <div className="space-y-2.5">
            {PORTIONED_FOOD_KEYS.map((foodKey) => (
              <PresetRow
                key={foodKey}
                label={FOOD_LABELS[foodKey]}
                amounts={cat.feeding_presets?.[foodKey] ?? []}
                onAdd={(amount) => {
                  const current = cat.feeding_presets?.[foodKey] ?? []
                  if (current.includes(amount)) return
                  onPresetsChange(cat.id, cat, foodKey, [...current, amount].sort((a, b) => a - b))
                }}
                onRemove={(amount) => {
                  const current = cat.feeding_presets?.[foodKey] ?? []
                  onPresetsChange(cat.id, cat, foodKey, current.filter((g) => g !== amount))
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Preset row (one food type) ───────────────────────────────────────────────

interface PresetRowProps {
  label:    string
  amounts:  number[]
  onAdd:    (amount: number) => void
  onRemove: (amount: number) => void
}

function PresetRow({ label, amounts, onAdd, onRemove }: PresetRowProps) {
  const [inputVal, setInputVal] = useState('')

  function handleAdd() {
    const n = parseInt(inputVal, 10)
    if (isNaN(n) || n <= 0 || n > 9999) return
    onAdd(n)
    setInputVal('')
  }

  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-muted-foreground w-8 pt-1.5 shrink-0">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5 flex-1">
        {amounts.length === 0 && (
          <span className="text-xs text-muted-foreground/60 italic">No presets — add one</span>
        )}
        {amounts.map((g) => (
          <span
            key={g}
            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-muted text-xs font-medium ring-1 ring-border/50"
          >
            {g}g
            <button
              type="button"
              onClick={() => onRemove(g)}
              className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
              aria-label={`Remove ${g}g preset`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}

        {/* Add input */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="1"
            max="9999"
            placeholder="g"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            className="h-7 w-16 rounded-lg border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!inputVal || isNaN(parseInt(inputVal, 10))}
            className="inline-flex items-center gap-0.5 h-7 px-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ring-1 ring-primary/20"
            aria-label={`Add ${label} preset`}
          >
            <Plus className="size-3" /> Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Toggle button ────────────────────────────────────────────────────────────

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
