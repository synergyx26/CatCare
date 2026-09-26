import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'
export type ColorAccent = 'blue' | 'rose' | 'scarlet' | 'orange' | 'green' | 'purple'
// 'playful' only takes effect when VITE_PLAYFUL_UI_ENABLED is on — see usePlayfulUi
export type UiStyle = 'classic' | 'playful'

interface ThemeStore {
  theme: Theme
  colorAccent: ColorAccent
  uiStyle: UiStyle
  setTheme: (t: Theme) => void
  setColorAccent: (a: ColorAccent) => void
  setUiStyle: (s: UiStyle) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'system',
      colorAccent: 'blue',
      uiStyle: 'classic',
      setTheme: (theme) => set({ theme }),
      setColorAccent: (colorAccent) => set({ colorAccent }),
      setUiStyle: (uiStyle) => set({ uiStyle }),
    }),
    { name: 'catcare_theme' }
  )
)
