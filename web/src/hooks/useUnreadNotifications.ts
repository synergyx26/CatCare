import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuthStore } from '@/store/authStore'

export const NOTIFICATIONS_KEY = ['notifications'] as const

/** Inbox query shared by the bell and the inbox page; polls so the badge stays fresh. */
export function useNotifications() {
  const token = useAuthStore((s) => s.token)
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: async () => {
      const res = await api.getNotifications()
      return {
        items: res.data.data as import('@/types/api').AppNotification[],
        unread: (res.data.meta?.unread ?? 0) as number,
      }
    },
    enabled: !!token,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  })
}
