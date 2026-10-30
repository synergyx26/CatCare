import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'
export type ColorAccent = 'blue' | 'rose' | 'scarlet' | 'orange' | 'green' | 'purple'
// 'playful' only takes effect when VITE_PLAYFUL_UI_ENABLED is on — see usePlayfulUi
export type UiStyle = 'classic' | 'playful'
// 'sidebar' only takes effect when VITE_SIDEBAR_NAV_ENABLED is on — see useSidebarNav
export type NavStyle = 'topbar' | 'sidebar'

interface ThemeStore {
  theme: Theme
  colorAccent: ColorAccent
  uiStyle: UiStyle
  navStyle: NavStyle
  navCollapsed: boolean
  setTheme: (t: Theme) => void
  setColorAccent: (a: ColorAccent) => void
  setUiStyle: (s: UiStyle) => void
  setNavStyle: (s: NavStyle) => void
  setNavCollapsed: (collapsed: boolean) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'system',
      colorAccent: 'blue',
      uiStyle: 'classic',
      navStyle: 'sidebar',
      navCollapsed: false,
      setTheme: (theme) => set({ theme }),
      setColorAccent: (colorAccent) => set({ colorAccent }),
      setUiStyle: (uiStyle) => set({ uiStyle }),
      setNavStyle: (navStyle) => set({ navStyle }),
      setNavCollapsed: (navCollapsed) => set({ navCollapsed }),
    }),
    { name: 'catcare_theme' }
  )
)
