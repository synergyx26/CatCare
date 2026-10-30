import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DatabaseBackup, Download, Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { usePageTitle } from '@/hooks/usePageTitle'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import type { BackupExport } from '@/types/api'

const KEY = ['admin_backups'] as const

function humanSize(bytes: number | null) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function AdminBackupsPage() {
  usePageTitle('Backups')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.adminBackups()).data.data as BackupExport[],
    refetchInterval: (q) => (q.state.data?.some((b) => b.status === 'pending') ? 3000 : false),
  })

  const create = useMutation({
    mutationFn: () => api.adminCreateBackup(),
    onSuccess: () => {
      notify.success('Backup started — you’ll get a notification when it’s ready')
      // The job runs in the background; poll a few times for the new row.
      ;[2000, 6000, 15000].forEach((ms) => setTimeout(() => queryClient.invalidateQueries({ queryKey: KEY }), ms))
    },
    onError: () => notify.error('Could not start a backup. Please try again.'),
  })

  const download = useMutation({
    mutationFn: async (b: BackupExport) => {
      const res = await api.adminDownloadBackup(b.id)
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = b.filename
      a.click()
      URL.revokeObjectURL(url)
    },
    onError: () => notify.error('Download failed. Please try again.'),
  })

  if (isLoading || !data) return <PageSkeleton />

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Database backups"
        subtitle="Nightly at 03:00 UTC — every table as CSV in one zip, kept 30 days. Super admins are notified when each one is ready."
        action={
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <DatabaseBackup className="size-4" />}
            Back up now
          </Button>
        }
      />

      {data.length === 0 ? (
        <EmptyState icon={DatabaseBackup} title="No backups yet" description="The first one is created tonight, or press “Back up now”." />
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
          {data.map((b) => {
            const rows = Object.values(b.table_counts).reduce((a, c) => a + c, 0)
            return (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{new Date(b.created_at).toLocaleString()}</p>
                  <p className={cn('text-xs', b.status === 'failed' ? 'text-destructive' : 'text-muted-foreground')}>
                    {b.status === 'ok' && `${Object.keys(b.table_counts).length} tables · ${rows.toLocaleString()} rows · ${humanSize(b.byte_size)}`}
                    {b.status === 'pending' && 'Running…'}
                    {b.status === 'failed' && `Failed: ${b.error ?? 'unknown error'}`}
                    {b.requested_by && ` · by ${b.requested_by}`}
                  </p>
                  {b.checksum_sha256 && <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/70">sha256 {b.checksum_sha256}</p>}
                </div>
                {b.status === 'ok' && (
                  <Button variant="outline" size="sm" onClick={() => download.mutate(b)} disabled={download.isPending}>
                    <Download className="size-4" /> Download
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
