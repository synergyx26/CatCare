import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/api'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  primaryHouseholdId: number | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  setHousehold: (id: number) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      primaryHouseholdId: null,

      setAuth: (user, token) => {
        localStorage.setItem('catcare_token', token)
        set({ user, token, isAuthenticated: true })
      },

      clearAuth: () => {
        localStorage.removeItem('catcare_token')
        set({ user: null, token: null, isAuthenticated: false, primaryHouseholdId: null })
      },

      setHousehold: (id) => {
        set({ primaryHouseholdId: id })
      },
    }),
    {
      name: 'catcare_auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        primaryHouseholdId: state.primaryHouseholdId,
      }),
    }
  )
)
