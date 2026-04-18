import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/api'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  activeHouseholdId: number | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  setActiveHousehold: (id: number) => void
  /** @deprecated use setActiveHousehold */
  setHousehold: (id: number) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      activeHouseholdId: null,

      setAuth: (user, token) => {
        localStorage.setItem('catcare_token', token)
        set({ user, token, isAuthenticated: true })
      },

      clearAuth: () => {
        localStorage.removeItem('catcare_token')
        set({ user: null, token: null, isAuthenticated: false, activeHouseholdId: null })
      },

      setActiveHousehold: (id) => set({ activeHouseholdId: id }),
      setHousehold:       (id) => set({ activeHouseholdId: id }),
    }),
    {
      name: 'catcare_auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        activeHouseholdId: state.activeHouseholdId,
      }),
    }
  )
)
