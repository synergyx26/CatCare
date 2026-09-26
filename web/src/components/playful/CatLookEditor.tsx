import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { Sparkles, RotateCcw } from 'lucide-react'
import { api } from '@/api/client'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui/button'
import type { ApiError, Cat, CatAppearance, CatPattern } from '@/types/api'
import { AnimatedCat, appearanceForCat, coatFromAppearance, luminance, mix } from './AnimatedCat'

// "Cartoon look" editor for the playful UI (Edit Cat page). Saves on its own
// via PATCH { cat: { appearance } }, independent of the page's main form.

const PATTERNS: { value: CatPattern; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'tabby', label: 'Tabby' },
  { value: 'tuxedo', label: 'Tuxedo' },
  { value: 'bicolor', label: 'Bicolour' },
  { value: 'calico', label: 'Calico' },
  { value: 'tortoiseshell', label: 'Tortie' },
  { value: 'colorpoint', label: 'Colourpoint' },
]

// What fur2/fur3 mean for each pattern (null = not used)
const SECONDARY: Record<CatPattern, { fur2: string | null; fur3: string | null }> = {
  solid:         { fur2: null, fur3: null },
  tabby:         { fur2: 'Stripes', fur3: null },
  tuxedo:        { fur2: 'White patches', fur3: null },
  bicolor:       { fur2: 'White patches', fur3: null },
  calico:        { fur2: 'Orange patches', fur3: 'Dark patches' },
  tortoiseshell: { fur2: 'Warm patches', fur3: 'Light patches' },
  colorpoint:    { fur2: 'Points (ears, face, paws, tail)', fur3: null },
}

// Sensible starting colours when switching to a pattern that needs fur2/fur3
const PATTERN_DEFAULTS: Record<CatPattern, Partial<CatAppearance>> = {
  solid:         {},
  tabby:         {}, // stripes derive from the fur colour — see setPattern
  tuxedo:        { fur: '#2f3036', fur2: '#f5f3ee' },
  bicolor:       { fur2: '#f5f3ee' },
  calico:        { fur: '#f5f3ee', fur2: '#f0a050', fur3: '#2f3036' },
  tortoiseshell: { fur: '#2f3036', fur2: '#c9783a' },
  colorpoint:    { fur: '#eedcc0', fur2: '#6b4a38' },
}

const FUR_SWATCHES = ['#2f3036', '#5a5d66', '#9ea6b3', '#c9ced6', '#f5f3ee', '#eedcc0', '#f0a050', '#d9772b', '#a86a30', '#8a5a3a', '#6b4a38', '#c9783a']
const EYE_SWATCHES = ['#f2c94c', '#c98a2b', '#8cc152', '#2f7d4f', '#6fa8dc', '#3b82c4', '#3b2a20']

interface CatLookEditorProps {
  cat: Cat
  householdId: number
}

export function CatLookEditor({ cat, householdId }: CatLookEditorProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<CatAppearance>(() => appearanceForCat(cat))

  // Re-seed when the saved look changes (after save/reset or a refetch)
  useEffect(() => {
    setDraft(appearanceForCat(cat))
  }, [cat.id, JSON.stringify(cat.appearance)]) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(normalise(draft)) !== JSON.stringify(cat.appearance ? normalise(cat.appearance) : null)

  function invalidateCats() {
    queryClient.invalidateQueries({ queryKey: ['cat'] })
    queryClient.invalidateQueries({ queryKey: ['cats'] })
  }

  const suggest = useMutation({
    mutationFn: () => api.getCatAppearanceSuggestion(householdId, cat.id),
    onSuccess: (res) => {
      setDraft(res.data.data as CatAppearance)
      notify.success(`Matched ${cat.name}'s colours — tweak anything that's off, then save.`)
    },
    onError: (err) => notify.error(errorMessage(err, "Couldn't match colours from the photo.")),
  })

  const save = useMutation({
    mutationFn: (appearance: CatAppearance | null) => api.updateCatAppearance(householdId, cat.id, appearance),
    onSuccess: (_res, appearance) => {
      invalidateCats()
      notify.success(appearance ? `Saved ${cat.name}'s look.` : `${cat.name} is back to the automatic look.`)
    },
    onError: (err) => notify.error(errorMessage(err, "Couldn't save the look. Please try again.")),
  })

  function setPattern(pattern: CatPattern) {
    setDraft((d) => {
      if (d.pattern === pattern) return d
      const defaults = PATTERN_DEFAULTS[pattern]
      const roles = SECONDARY[pattern]
      // Keep the user's fur colour unless the pattern implies one (tuxedo, calico…)
      const fur = defaults.fur ?? d.fur
      // Tabby stripes: a shade of the fur — lighter on dark cats so they stay visible
      const stripes = luminance(fur) < 90 ? mix(fur, '#ffffff', 0.3) : mix(fur, '#000000', 0.28)
      const fur2 = pattern === 'tabby' ? stripes : defaults.fur2
      return {
        pattern,
        fur,
        fur2: roles.fur2 ? fur2 ?? d.fur2 ?? null : null,
        fur3: roles.fur3 ? defaults.fur3 ?? d.fur3 ?? null : null,
        eyes: d.eyes,
      }
    })
  }

  const roles = SECONDARY[draft.pattern]
  const previewCoat = coatFromAppearance(draft)

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cartoon look</p>
        <p className="mt-1 text-xs text-muted-foreground">
          How {cat.name} appears on the playful dashboard.
          {!cat.appearance && ' Not set yet — showing an automatic look.'}
        </p>
      </div>

      {/* Preview beside the real photo */}
      <div className="flex items-end justify-center gap-4">
        {cat.photo_url && (
          <img src={cat.photo_url} alt={cat.name} className="size-24 rounded-2xl object-cover ring-1 ring-border" />
        )}
        <div
          className="flex h-28 w-28 items-end justify-center rounded-2xl"
          style={{ background: `linear-gradient(160deg, ${previewCoat.tint[0]}, ${previewCoat.tint[1]})` }}
        >
          <AnimatedCat coat={previewCoat} mood="happy" className="h-24 w-24" />
        </div>
      </div>

      {cat.photo_url ? (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => suggest.mutate()}
          disabled={suggest.isPending}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          {suggest.isPending ? 'Looking at the photo…' : 'Match from photo'}
        </Button>
      ) : (
        <p className="text-center text-xs text-muted-foreground">Save a photo of {cat.name} to match colours automatically.</p>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Pattern</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Coat pattern">
          {PATTERNS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={draft.pattern === p.value}
              onClick={() => setPattern(p.value)}
              className={[
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                draft.pattern === p.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <ColourRow label="Fur" value={draft.fur} swatches={FUR_SWATCHES} onChange={(fur) => setDraft((d) => ({ ...d, fur }))} />
      {roles.fur2 && (
        <ColourRow label={roles.fur2} value={draft.fur2 ?? '#a86a30'} swatches={FUR_SWATCHES} onChange={(fur2) => setDraft((d) => ({ ...d, fur2 }))} />
      )}
      {roles.fur3 && (
        <ColourRow label={roles.fur3} value={draft.fur3 ?? '#2f3036'} swatches={FUR_SWATCHES} onChange={(fur3) => setDraft((d) => ({ ...d, fur3 }))} />
      )}
      <ColourRow label="Eyes" value={draft.eyes} swatches={EYE_SWATCHES} onChange={(eyes) => setDraft((d) => ({ ...d, eyes }))} />

      <div className="flex gap-2">
        <Button type="button" className="flex-1" onClick={() => save.mutate(normalise(draft))} disabled={!dirty || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save look'}
        </Button>
        {cat.appearance && (
          <Button type="button" variant="ghost" className="gap-1.5" onClick={() => save.mutate(null)} disabled={save.isPending}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset
          </Button>
        )}
      </div>
    </section>
  )
}

function ColourRow({ label, value, swatches, onChange }: {
  label: string
  value: string
  swatches: string[]
  onChange: (hex: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {swatches.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(hex)}
            aria-label={`${label}: ${hex}`}
            aria-pressed={value.toLowerCase() === hex}
            className={[
              'size-7 rounded-full border transition-transform hover:scale-110',
              value.toLowerCase() === hex ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : '',
            ].join(' ')}
            style={{ backgroundColor: hex, borderColor: luminance(hex) > 225 ? 'var(--border)' : 'transparent' }}
          />
        ))}
        <label
          className="relative size-7 cursor-pointer overflow-hidden rounded-full transition-transform hover:scale-110"
          style={{ background: 'conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7, #ef4444)' }}
          title="Pick any colour"
        >
          <span className="sr-only">{label}: custom colour</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <span className="pointer-events-none absolute inset-[5px] rounded-full ring-2 ring-card" style={{ backgroundColor: value }} />
        </label>
      </div>
    </div>
  )
}

/** Drop pattern colours the pattern doesn't use, so saved JSON stays tidy. */
function normalise(a: CatAppearance): CatAppearance {
  const roles = SECONDARY[a.pattern]
  const out: CatAppearance = { pattern: a.pattern, fur: a.fur.toLowerCase(), eyes: a.eyes.toLowerCase() }
  if (roles.fur2 && a.fur2) out.fur2 = a.fur2.toLowerCase()
  if (roles.fur3 && a.fur3) out.fur3 = a.fur3.toLowerCase()
  return out
}

function errorMessage(err: unknown, fallback: string): string {
  return (err as AxiosError<ApiError>).response?.data?.message ?? fallback
}
