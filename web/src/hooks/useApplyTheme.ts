import { useEffect } from 'react'
import { useThemeStore } from '@/store/themeStore'

export function useApplyTheme() {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement

    function apply(isDark: boolean) {
      root.classList.toggle('dark', isDark)
    }

    if (theme === 'dark') {
      apply(true)
      return
    }

    if (theme === 'light') {
      apply(false)
      return
    }

    // system
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    apply(mq.matches)

    const handler = (e: MediaQueryListEvent) => apply(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])
}
