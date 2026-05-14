import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'
export type ColorAccent = 'blue' | 'rose' | 'scarlet' | 'orange' | 'green' | 'purple'

interface ThemeStore {
  theme: Theme
  colorAccent: ColorAccent
  setTheme: (t: Theme) => void
  setColorAccent: (a: ColorAccent) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'system',
      colorAccent: 'blue',
      setTheme: (theme) => set({ theme }),
      setColorAccent: (colorAccent) => set({ colorAccent }),
    }),
    { name: 'catcare_theme' }
  )
)
