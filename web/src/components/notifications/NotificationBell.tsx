import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/hooks/useUnreadNotifications'

export function NotificationBell() {
  const navigate = useNavigate()
  const { data } = useNotifications()
  const unread = data?.unread ?? 0
  const label = unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'

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
