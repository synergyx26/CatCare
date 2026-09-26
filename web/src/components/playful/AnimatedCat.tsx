// Illustrated, CSS-animated cat used by the playful UI preview. All motion
// lives in styles/playful.css (pl-cat-* classes) and is disabled under
// prefers-reduced-motion.

export type CatMood = 'happy' | 'hungry' | 'sleep' | 'party'

export interface CatCoat {
  body: string
  belly: string
  stripe: string | null
  ear: string
  eye: string
  pupil: string | null
  line: string
  /** Card header gradient (light, dark) — keeps each cat's card distinct. */
  tint: [string, string]
}

const COATS: CatCoat[] = [
  // orange tabby
  { body: '#f4a259', belly: '#fde2c4', stripe: '#d9772b', ear: '#f7b2b7', eye: '#3b2a20', pupil: null, line: '#7a4a2a', tint: ['#ffe3c2', '#ffd0a6'] },
  // grey
  { body: '#a3acb9', belly: '#e8ebf0', stripe: null, ear: '#f2b8c6', eye: '#2f7d4f', pupil: null, line: '#4b5260', tint: ['#dbe7ff', '#cfd9f5'] },
  // black
  { body: '#34343d', belly: '#4b4b57', stripe: null, ear: '#c98a9a', eye: '#f2c94c', pupil: '#1a1a1f', line: '#9a9aab', tint: ['#ffd9e8', '#f7c6dc'] },
  // cream / point
  { body: '#efe2cf', belly: '#fbf5ec', stripe: '#8b6a55', ear: '#8b6a55', eye: '#3b82c4', pupil: null, line: '#6b5244', tint: ['#e3f4ec', '#cfeadd'] },
  // tuxedo
  { body: '#2f3036', belly: '#f7f7f5', stripe: null, ear: '#d99aa8', eye: '#8cc152', pupil: '#1a1a1f', line: '#9a9aab', tint: ['#efe4ff', '#e0d2fb'] },
]

/**
 * Stable coat per cat. Cats have no coat-colour field, so this is a
 * deterministic pick by id — it won't match the real cat, but the same cat
 * always looks the same.
 */
export function coatForCat(catId: number): CatCoat {
  return COATS[Math.abs(catId) % COATS.length]
}

interface AnimatedCatProps {
  coat: CatCoat
  mood?: CatMood
  className?: string
  /** SVG viewBox override — used to crop to just the head (e.g. peeking cat). */
  viewBox?: string
}

export function AnimatedCat({ coat: c, mood = 'happy', className, viewBox = '0 -8 120 108' }: AnimatedCatProps) {
  const hungry = mood === 'hungry'
  const eyeRx = hungry ? 5 : 4
  const eyeRy = hungry ? 6 : 5

  return (
    <svg className={`pl-cat pl-cat-${mood} ${className ?? ''}`} viewBox={viewBox} aria-hidden="true" overflow="visible">
      <path className="pl-cat-tail" d="M86 84 C112 84 114 52 101 42" stroke={c.body} strokeWidth="10" fill="none" strokeLinecap="round" />
      <g className="pl-cat-body">
        <ellipse cx="60" cy="74" rx="30" ry="23" fill={c.body} />
        <ellipse cx="60" cy="80" rx="16" ry="14" fill={c.belly} />
        <g className="pl-cat-ear">
          <polygon points="38,30 36,4 57,20" fill={c.body} />
          <polygon points="41,25 40,11 51,20" fill={c.ear} />
        </g>
        <polygon points="82,30 84,4 63,20" fill={c.body} />
        <polygon points="79,25 80,11 69,20" fill={c.ear} />
        <circle cx="60" cy="41" r="24" fill={c.body} />

        {c.stripe && (
          <>
            <path d="M60 17 v8 M52 19 l2 6 M68 19 l-2 6" stroke={c.stripe} strokeWidth="3" strokeLinecap="round" />
            <path d="M34 66 q6 2 8 8 M86 66 q-6 2 -8 8 M32 78 q6 1 8 6 M88 78 q-6 1 -8 6" stroke={c.stripe} strokeWidth="3" fill="none" strokeLinecap="round" />
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
        <ellipse cx="49" cy="95" rx="8" ry="5" fill={c.belly} />
        <ellipse cx="71" cy="95" rx="8" ry="5" fill={c.belly} />

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
  const c = COATS[0]
  return (
    <svg className={className} viewBox="0 0 100 60" aria-hidden="true" overflow="visible">
      <path className="pl-walk-tail" d="M24 28 C10 26 6 12 12 4" stroke={c.body} strokeWidth="6" fill="none" strokeLinecap="round" />
      <rect className="pl-leg pl-leg-b" x="30" y="34" width="6" height="18" rx="3" fill={c.stripe!} />
      <rect className="pl-leg" x="58" y="34" width="6" height="18" rx="3" fill={c.stripe!} />
      <ellipse cx="46" cy="32" rx="26" ry="13" fill={c.body} />
      <path d="M38 21 q2 6 0 12 M48 20 q2 6 0 12" stroke={c.stripe!} strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect className="pl-leg" x="36" y="36" width="6" height="18" rx="3" fill={c.body} />
      <rect className="pl-leg pl-leg-b" x="64" y="36" width="6" height="18" rx="3" fill={c.body} />
      <polygon points="64,16 66,2 74,12" fill={c.body} />
      <polygon points="76,12 82,1 85,15" fill={c.body} />
      <circle cx="74" cy="22" r="12" fill={c.body} />
      <circle cx="79" cy="20" r="1.8" fill={c.eye} />
      <path d="M84 25 l2 -1" stroke="#ff8fa3" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export const PEEK_COAT = COATS[2]
