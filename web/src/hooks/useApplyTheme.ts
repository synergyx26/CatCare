import { useEffect } from 'react'
import { useThemeStore, type ColorAccent } from '@/store/themeStore'

const ALL_ACCENTS: ColorAccent[] = ['blue', 'rose', 'scarlet', 'orange', 'green', 'purple']

export function useApplyTheme() {
  const theme = useThemeStore((s) => s.theme)
  const colorAccent = useThemeStore((s) => s.colorAccent)

  useEffect(() => {
    const root = document.documentElement

    function applyDark(isDark: boolean) {
      root.classList.toggle('dark', isDark)
    }

    if (theme === 'dark') {
      applyDark(true)
      return
    }

    if (theme === 'light') {
      applyDark(false)
      return
    }

    // system
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    applyDark(mq.matches)

    const handler = (e: MediaQueryListEvent) => applyDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    ALL_ACCENTS.forEach((a) => root.classList.remove(`accent-${a}`))
    if (colorAccent !== 'blue') {
      root.classList.add(`accent-${colorAccent}`)
    }
  }, [colorAccent])
}
