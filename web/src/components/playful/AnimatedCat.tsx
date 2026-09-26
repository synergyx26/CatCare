import { useId } from 'react'
import type { CatAppearance, CatPattern } from '@/types/api'

// Illustrated, CSS-animated cat used by the playful UI preview. All motion
// lives in styles/playful.css (pl-cat-* classes) and is disabled under
// prefers-reduced-motion. What the cat looks like comes from a CatAppearance
// (pattern + colours, saved per cat); coatFromAppearance turns that into the
// concrete fills the SVG needs.

export type CatMood = 'happy' | 'hungry' | 'sleep' | 'party'

interface Patch { color: string; cx: number; cy: number; rx: number; ry: number }

export interface CatCoat {
  pattern: CatPattern
  body: string
  belly: string
  paws: string
  tail: string
  earLeft: string
  earRight: string
  earInner: string
  stripe: string | null
  /** White lower face (tuxedo / bicolor) */
  muzzle: string | null
  /** Dark face mask (colorpoint) */
  mask: string | null
  patches: Patch[]
  eye: string
  pupil: string | null
  line: string
  /** Card header gradient — keeps each cat's card distinct. */
  tint: [string, string]
}

// ── Colour helpers ─────────────────────────────────────────────────────────

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

function toHex(rgb: number[]): string {
  return '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')
}

/** Linear blend: t=0 → a, t=1 → b */
export function mix(a: string, b: string, t: number): string {
  const x = toRgb(a)
  const y = toRgb(b)
  return toHex(x.map((v, i) => v + (y[i] - v) * t))
}

export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex)
  return 0.299 * r + 0.587 * g + 0.114 * b
}

const WHITE = '#f5f3ee'
const BLACK = '#2f3036'
const lighten = (hex: string, t: number) => mix(hex, '#ffffff', t)
const darken = (hex: string, t: number) => mix(hex, '#000000', t)

// ── Appearance → coat ─────────────────────────────────────────────────────

const CALICO_ORANGE: Omit<Patch, 'color'>[] = [
  { cx: 46, cy: 30, rx: 13, ry: 11 },
  { cx: 79, cy: 72, rx: 14, ry: 12 },
  { cx: 50, cy: 91, rx: 8, ry: 5 },
]
const CALICO_BLACK: Omit<Patch, 'color'>[] = [
  { cx: 74, cy: 27, rx: 11, ry: 9 },
  { cx: 40, cy: 78, rx: 12, ry: 10 },
]
const TORTIE_A: Omit<Patch, 'color'>[] = [
  { cx: 48, cy: 31, rx: 7, ry: 6 },
  { cx: 71, cy: 50, rx: 6, ry: 5 },
  { cx: 44, cy: 70, rx: 9, ry: 7 },
  { cx: 76, cy: 84, rx: 8, ry: 6 },
  { cx: 62, cy: 63, rx: 6, ry: 5 },
]
const TORTIE_B: Omit<Patch, 'color'>[] = [
  { cx: 66, cy: 28, rx: 5, ry: 4 },
  { cx: 52, cy: 86, rx: 7, ry: 5 },
  { cx: 82, cy: 68, rx: 5, ry: 4 },
]

const withColor = (color: string, shapes: Omit<Patch, 'color'>[]): Patch[] => shapes.map((s) => ({ ...s, color }))

export function coatFromAppearance(a: CatAppearance): CatCoat {
  const fur = a.fur
  const fur2 = a.fur2 ?? null
  const fur3 = a.fur3 ?? null
  const darkBody = luminance(fur) < 90

  let belly = lighten(fur, 0.4)
  let paws = belly
  let tail = fur
  let earLeft = fur
  let earRight = fur
  let stripe: string | null = null
  let muzzle: string | null = null
  let mask: string | null = null
  let patches: Patch[] = []

  switch (a.pattern) {
    case 'tabby':
      stripe = fur2 ?? (darkBody ? lighten(fur, 0.3) : darken(fur, 0.28))
      belly = lighten(fur, 0.45)
      paws = belly
      break
    case 'tuxedo':
    case 'bicolor': {
      const white = fur2 ?? WHITE
      belly = white
      paws = white
      muzzle = white
      break
    }
    case 'calico': {
      const orange = fur2 ?? '#f0a050'
      const black = fur3 ?? BLACK
      belly = fur
      paws = fur
      tail = orange
      earLeft = black
      earRight = orange
      patches = [...withColor(orange, CALICO_ORANGE), ...withColor(black, CALICO_BLACK)]
      break
    }
    case 'tortoiseshell': {
      const warm = fur2 ?? '#c9783a'
      belly = mix(fur, warm, 0.25)
      paws = belly
      earLeft = warm
      patches = [...withColor(warm, TORTIE_A), ...withColor(fur3 ?? lighten(warm, 0.25), TORTIE_B)]
      break
    }
    case 'colorpoint': {
      const points = fur2 ?? '#6b4a38'
      belly = lighten(fur, 0.35)
      paws = points
      tail = points
      earLeft = points
      earRight = points
      mask = points
      break
    }
    case 'solid':
      break
  }

  const face = mask ?? muzzle ?? fur
  const line = luminance(face) < 90 ? '#b3b3c2' : darken(face, 0.5)
  const tintBase = a.pattern === 'calico' ? (fur2 ?? fur) : fur
  const tint: [string, string] =
    luminance(tintBase) < 70 ? ['#ffd9e8', '#f7c6dc']
      : luminance(tintBase) > 225 ? ['#dbe7ff', '#cfd9f5']
        : [lighten(tintBase, 0.72), lighten(tintBase, 0.58)]

  return {
    pattern: a.pattern,
    body: fur,
    belly,
    paws,
    tail,
    earLeft,
    earRight,
    earInner: darkBody ? '#c98a9a' : '#f7b2b7',
    stripe,
    muzzle,
    mask,
    patches,
    eye: a.eyes,
    pupil: luminance(a.eyes) > 90 ? '#1a1a1f' : null,
    line,
    tint,
  }
}

// Used until someone saves a look for the cat (Cat.appearance is null).
const FALLBACK_APPEARANCES: CatAppearance[] = [
  { pattern: 'tabby', fur: '#f4a259', fur2: '#d9772b', eyes: '#3b2a20' },
  { pattern: 'solid', fur: '#a3acb9', eyes: '#2f7d4f' },
  { pattern: 'solid', fur: '#34343d', eyes: '#f2c94c' },
  { pattern: 'colorpoint', fur: '#efe2cf', fur2: '#8b6a55', eyes: '#3b82c4' },
  { pattern: 'tuxedo', fur: '#2f3036', fur2: '#f7f7f5', eyes: '#8cc152' },
]

/** The cat's saved look, or a stable fallback picked by id. */
export function appearanceForCat(cat: { id: number; appearance?: CatAppearance | null }): CatAppearance {
  return cat.appearance ?? FALLBACK_APPEARANCES[Math.abs(cat.id) % FALLBACK_APPEARANCES.length]
}

export function coatForCat(cat: { id: number; appearance?: CatAppearance | null }): CatCoat {
  return coatFromAppearance(appearanceForCat(cat))
}

export const PEEK_COAT = coatFromAppearance(FALLBACK_APPEARANCES[2])

// ── Drawing ────────────────────────────────────────────────────────────────

interface AnimatedCatProps {
  coat: CatCoat
  mood?: CatMood
  className?: string
  /** SVG viewBox override — used to crop to just the head (e.g. peeking cat). */
  viewBox?: string
}

export function AnimatedCat({ coat: c, mood = 'happy', className, viewBox = '0 -8 120 108' }: AnimatedCatProps) {
  // useId output can contain characters that break url(#…) references
  const clipId = `pl-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const hungry = mood === 'hungry'
  const eyeRx = hungry ? 5 : 4
  const eyeRy = hungry ? 6 : 5

  return (
    <svg className={`pl-cat pl-cat-${mood} ${className ?? ''}`} viewBox={viewBox} aria-hidden="true" overflow="visible">
      <defs>
        <clipPath id={clipId}>
          <ellipse cx="60" cy="74" rx="30" ry="23" />
          <circle cx="60" cy="41" r="24" />
        </clipPath>
      </defs>

      <path className="pl-cat-tail" d="M86 84 C112 84 114 52 101 42" stroke={c.tail} strokeWidth="10" fill="none" strokeLinecap="round" />
      <g className="pl-cat-body">
        <ellipse cx="60" cy="74" rx="30" ry="23" fill={c.body} />
        <ellipse cx="60" cy="80" rx="16" ry="14" fill={c.belly} />
        <g className="pl-cat-ear">
          <polygon points="38,30 36,4 57,20" fill={c.earLeft} />
          <polygon points="41,25 40,11 51,20" fill={c.earInner} />
        </g>
        <polygon points="82,30 84,4 63,20" fill={c.earRight} />
        <polygon points="79,25 80,11 69,20" fill={c.earInner} />
        <circle cx="60" cy="41" r="24" fill={c.body} />

        {c.patches.length > 0 && (
          <g clipPath={`url(#${clipId})`}>
            {c.patches.map((p, i) => (
              <ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={p.color} />
            ))}
          </g>
        )}

        {c.stripe && (
          <>
            <path d="M60 17 v8 M52 19 l2 6 M68 19 l-2 6" stroke={c.stripe} strokeWidth="3" strokeLinecap="round" />
            <path d="M34 66 q6 2 8 8 M86 66 q-6 2 -8 8 M32 78 q6 1 8 6 M88 78 q-6 1 -8 6" stroke={c.stripe} strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        )}

        {c.mask && <ellipse cx="60" cy="46" rx="15" ry="12" fill={c.mask} opacity=".9" />}
        {c.muzzle && (
          <>
            <ellipse cx="60" cy="51" rx="12" ry="8" fill={c.muzzle} />
            <path d="M60 30 L55 44 H65 Z" fill={c.muzzle} />
          </>
        )}

        {mood !== 'sleep' && (
          <>
            <circle cx="43" cy="48" r="4" fill="#ff8fa3" opacity=".45" />
            <circle cx="77" cy="48" r="4" fill="#ff8fa3" opacity=".45" />
          </>
        )}

        {mood === 'sleep' ? (
          <path d="M45 41 q5 4 11 0 M64 41 q5 4 11 0" stroke={c.line} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        ) : (
          <g className="pl-cat-eyes">
            <ellipse cx="51" cy="40" rx={eyeRx} ry={eyeRy} fill={c.eye} />
            <ellipse cx="69" cy="40" rx={eyeRx} ry={eyeRy} fill={c.eye} />
            {c.pupil && (
              <>
                <ellipse cx="51" cy="40" rx="1.4" ry="4" fill={c.pupil} />
                <ellipse cx="69" cy="40" rx="1.4" ry="4" fill={c.pupil} />
              </>
            )}
            <circle cx="52.6" cy="37.6" r="1.6" fill="#fff" />
            <circle cx="70.6" cy="37.6" r="1.6" fill="#fff" />
          </g>
        )}

        <path d="M57.5 46 h5 l-2.5 3 z" fill="#ff8fa3" />
        {hungry ? (
          <ellipse cx="60" cy="53" rx="3.2" ry="3.8" fill="#8a3434" />
        ) : (
          <path d="M55 50 q2.5 3.2 5 0 q2.5 3.2 5 0" stroke={c.line} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        )}
        <path d="M40 47 l-12 -2 M40 50 l-12 2 M80 47 l12 -2 M80 50 l12 2" stroke={c.line} strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
        <ellipse cx="49" cy="95" rx="8" ry="5" fill={c.paws} />
        <ellipse cx="71" cy="95" rx="8" ry="5" fill={c.paws} />

        {mood === 'party' && (
          <g className="pl-cat-hat">
            <polygon points="72,-4 60,20 80,22" fill="#ec4899" />
            <path d="M64 13 L78 15 M68 5 L76 7" stroke="#fde68a" strokeWidth="2.4" />
            <circle cx="72" cy="-5" r="3.6" fill="#f59e0b" />
          </g>
        )}
      </g>
    </svg>
  )
}

/** Side-view cat with stepping legs — walks across the dashboard hero. */
export function WalkingCat({ className }: { className?: string }) {
  const body = '#f4a259'
  const stripe = '#d9772b'
  return (
    <svg className={className} viewBox="0 0 100 60" aria-hidden="true" overflow="visible">
      <path className="pl-walk-tail" d="M24 28 C10 26 6 12 12 4" stroke={body} strokeWidth="6" fill="none" strokeLinecap="round" />
      <rect className="pl-leg pl-leg-b" x="30" y="34" width="6" height="18" rx="3" fill={stripe} />
      <rect className="pl-leg" x="58" y="34" width="6" height="18" rx="3" fill={stripe} />
      <ellipse cx="46" cy="32" rx="26" ry="13" fill={body} />
      <path d="M38 21 q2 6 0 12 M48 20 q2 6 0 12" stroke={stripe} strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect className="pl-leg" x="36" y="36" width="6" height="18" rx="3" fill={body} />
      <rect className="pl-leg pl-leg-b" x="64" y="36" width="6" height="18" rx="3" fill={body} />
      <polygon points="64,16 66,2 74,12" fill={body} />
      <polygon points="76,12 82,1 85,15" fill={body} />
      <circle cx="74" cy="22" r="12" fill={body} />
      <circle cx="79" cy="20" r="1.8" fill="#3b2a20" />
      <path d="M84 25 l2 -1" stroke="#ff8fa3" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
