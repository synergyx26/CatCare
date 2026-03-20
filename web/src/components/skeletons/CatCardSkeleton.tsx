import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export function CatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Skeleton className="size-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-40" />
        </div>
      </CardContent>
    </Card>
  )
}
