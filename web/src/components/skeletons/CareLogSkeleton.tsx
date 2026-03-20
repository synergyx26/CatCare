import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

export function CareLogSkeleton() {
  return (
    <Card>
      <div className="divide-y">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-3 w-10 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
