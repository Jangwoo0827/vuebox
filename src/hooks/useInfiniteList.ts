import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import type { Page } from '@/types/youtube'

/** pageToken-based pagination + an IntersectionObserver sentinel for infinite scroll. */
export function useInfiniteList<P extends Page<unknown>>(key: QueryKey, fetchPage: (pageToken?: string) => Promise<P>, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextPageToken ?? undefined,
    enabled,
    staleTime: 15 * 60_000,
    retry: false, // quota-sensitive: failures surface to the user instead of silently retrying
  })

  const items = useMemo(() => (query.data?.pages.flatMap((p) => p.items) ?? []) as P['items'], [query.data])
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage || isFetchingNextPage || isError) return
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void fetchNextPage(), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage, items.length])

  return { ...query, items, sentinel }
}
