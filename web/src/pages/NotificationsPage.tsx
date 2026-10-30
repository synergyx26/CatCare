import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, DatabaseBackup, AlertTriangle } from 'lucide-react'
import { api } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { NOTIFICATIONS_KEY, useNotifications } from '@/hooks/useUnreadNotifications'
import { cn } from '@/lib/utils'
import type { AppNotification } from '@/types/api'

function KindIcon({ kind }: { kind: string }) {
  if (kind === 'backup.failed') return <AlertTriangle className="size-4 text-destructive" />
  if (kind.startsWith('backup.')) return <DatabaseBackup className="size-4 text-primary" />
  return <Bell className="size-4 text-primary" />
}

export function NotificationsPage() {
  usePageTitle('Notifications')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isLoading } = useNotifications()

  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
  const markRead = useMutation({ mutationFn: (id: number) => api.markNotificationRead(id), onSuccess: refresh })
  const markAll = useMutation({ mutationFn: () => api.markAllNotificationsRead(), onSuccess: refresh })

  if (isLoading || !data) return <PageSkeleton />

  function open(n: AppNotification) {
    if (!n.read) markRead.mutate(n.id)
    if (n.url) navigate(n.url)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Notifications"
        subtitle={data.unread > 0 ? `${data.unread} unread` : 'You’re all caught up'}
        action={
          data.unread > 0 ? (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <CheckCheck className="size-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      {data.items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="Alerts about backups, care reminders and more will show up here." />
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
          {data.items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={cn('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60', !n.read && 'bg-primary/5')}
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <KindIcon kind={n.kind} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm', !n.read ? 'font-semibold' : 'font-medium')}>{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>}
                  <span className="mt-1 block text-[11px] text-muted-foreground/80">{new Date(n.created_at).toLocaleString()}</span>
                </span>
                {!n.read && <span aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
