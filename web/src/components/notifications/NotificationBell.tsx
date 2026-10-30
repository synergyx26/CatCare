import { useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/hooks/useUnreadNotifications'

export function NotificationBell() {
  const navigate = useNavigate()
  const { data } = useNotifications()
  const unread = data?.unread ?? 0
  const label = unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'

  // Surface anything new that arrives while the app is open. The first load
  // only records what's already there, so opening the app never replays old items.
  const lastSeenId = useRef<number | null>(null)
  useEffect(() => {
    if (!data) return
    const newest = data.items[0]?.id ?? 0
    if (lastSeenId.current !== null && newest > lastSeenId.current) {
      data.items
        .filter((n) => n.id > lastSeenId.current! && !n.read)
        .slice(0, 3)
        .forEach((n) => toast(n.title, { description: n.body ?? undefined, action: n.url ? { label: 'View', onClick: () => navigate(n.url!) } : undefined }))
    }
    lastSeenId.current = Math.max(lastSeenId.current ?? 0, newest)
  }, [data, navigate])

  return (
    <Button variant="ghost" size="icon-sm" onClick={() => navigate('/notifications')} aria-label={label} title={label} className="relative">
      <Bell className="size-4" aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Button>
  )
}
