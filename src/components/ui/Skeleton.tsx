export const Skeleton = ({ className = '' }: { className?: string }) => <div aria-hidden className={`skeleton ${className}`} />

export function VideoCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <Skeleton className="aspect-video w-full !rounded-lg" />
      <div className="flex gap-3">
        <Skeleton className="size-9 shrink-0 !rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  )
}

export function VideoGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-6 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" role="status" aria-label="불러오는 중">
      {Array.from({ length: count }, (_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function SearchSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="검색 중">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 sm:flex-row" aria-hidden>
          <Skeleton className="aspect-video w-full shrink-0 !rounded-lg sm:w-64" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PlayerSkeleton() {
  return (
    <div role="status" aria-label="플레이어 불러오는 중">
      <Skeleton className="aspect-video w-full !rounded-lg" />
      <Skeleton className="mt-4 h-6 w-3/4" />
      <Skeleton className="mt-3 h-4 w-1/3" />
    </div>
  )
}
