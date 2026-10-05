import { Loader2 } from 'lucide-react'
import type { RefObject } from 'react'
import { VideoGridSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/StateViews'
import type { Video } from '@/types/youtube'
import { VideoGrid } from './VideoGrid'

/** The slice of useInfiniteList() this component needs. */
interface ListLike {
  items: Video[]
  isPending: boolean
  isError: boolean
  error: unknown
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  hasNextPage: boolean
  refetch: () => unknown
  fetchNextPage: () => unknown
  sentinel: RefObject<HTMLDivElement | null>
}

interface Props {
  list: ListLike
  emptyTitle?: string
  emptyDescription?: string
  filter?: (v: Video) => boolean
}

/** Renders the loading / error / empty / grid + infinite-scroll states for a paginated video list. */
export function InfiniteVideoGrid({ list, emptyTitle = '표시할 영상이 없습니다', emptyDescription, filter }: Props) {
  const items = filter ? list.items.filter(filter) : list.items
  if (list.isPending) return <VideoGridSkeleton />
  if (list.isError && items.length === 0) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />
  if (items.length === 0 && list.hasNextPage) {
    // A client-side filter hid everything so far: keep paging until something matches.
    return (
      <>
        <VideoGridSkeleton count={4} />
        <div ref={list.sentinel} className="h-16" />
      </>
    )
  }
  if (items.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />
  return (
    <>
      <VideoGrid videos={items} />
      <div ref={list.sentinel} className="flex h-16 items-center justify-center">
        {list.isFetchingNextPage && <Loader2 className="size-5 animate-spin text-text-secondary" aria-label="더 불러오는 중" />}
      </div>
      {list.isFetchNextPageError && <ErrorState compact error={list.error} onRetry={() => void list.fetchNextPage()} />}
    </>
  )
}
