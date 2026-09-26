import { useState } from 'react'
import { AnimatedCat, PEEK_COAT } from './AnimatedCat'

const LINES = ['meow!', 'mrrp?', 'pspsps?', 'treats??', 'purr…']

/** Cat that periodically peeks up from the bottom-right corner (desktop only). */
export function PeekingCat() {
  const [line, setLine] = useState<string | null>(null)

  function say() {
    setLine(LINES[Math.floor(Math.random() * LINES.length)])
    window.setTimeout(() => setLine(null), 1500)
  }

  return (
    <>
      <div className="pl-peek fixed bottom-0 right-6 z-40 hidden h-[70px] w-[86px] overflow-hidden md:block">
        <button type="button" onClick={say} aria-label="Say hi to the cat" className="pl-peek-inner block w-full">
          <AnimatedCat coat={PEEK_COAT} viewBox="28 -2 64 60" className="block w-full" />
        </button>
      </div>
      <div
        aria-live="polite"
        className={`pl-peek-say fixed bottom-16 right-24 z-40 hidden rounded-2xl rounded-br-sm bg-card px-3 py-1.5 text-sm font-bold shadow-lg md:block ${line ? 'pl-peek-say-show' : ''}`}
      >
        {line}
      </div>
    </>
  )
}
