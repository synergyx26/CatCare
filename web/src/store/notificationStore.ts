import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NotificationPreferences } from '@/types/api'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/types/api'

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

interface NotificationState {
  preferences: NotificationPreferences
  /** Replace all preferences — called on login hydration from server. */
  setPreferences: (prefs: NotificationPreferences) => void
  /** Shallow-merge a single channel — used for live preview before Save. */
  mergePreferences: (partial: DeepPartial<NotificationPreferences>) => void
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,

      setPreferences: (prefs) => set({ preferences: prefs }),

      mergePreferences: (partial) => {
        const curr = get().preferences
        set({
          preferences: {
            in_app: { ...curr.in_app, ...(partial.in_app ?? {}) },
            email:  { ...curr.email,  ...(partial.email  ?? {}) },
            push:   { ...curr.push,   ...(partial.push   ?? {}) },
          },
        })
      },
    }),
    { name: 'catcare_notifications' }
  )
)
