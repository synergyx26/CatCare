// Ephemeral celebration particles for the playful UI. These are fire-and-forget
// DOM nodes (not React state) so a burst never re-renders the card; each node
// removes itself once its CSS animation (pl-float-up in playful.css) ends.

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Float emoji up out of `container` (which must be position: relative). */
export function floatEmoji(container: HTMLElement | null, glyphs: string[], count = 6) {
  if (!container || prefersReducedMotion()) return
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span')
    el.className = 'pl-float'
    el.textContent = glyphs[i % glyphs.length]
    el.style.left = `${35 + Math.random() * 30}%`
    el.style.setProperty('--pl-dx', `${Math.random() * 80 - 40}px`)
    el.style.animationDelay = `${i * 110}ms`
    el.addEventListener('animationend', () => el.remove(), { once: true })
    container.appendChild(el)
  }
}
