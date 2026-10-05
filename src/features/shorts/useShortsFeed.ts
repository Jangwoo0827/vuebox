import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { isShortVideo } from '@/constants/video'
import { recommender } from '@/features/recommendations/ranker'
import { useRecommendationContext } from '@/features/recommendations/useRecommendationContext'
import { useAuth } from '@/hooks/useAuth'
import { useInfiniteList } from '@/hooks/useInfiniteList'
import { useSubscriptions } from '@/hooks/useLibrary'
import { useSettings } from '@/hooks/useSettings'
import { qk } from '@/lib/queryKeys'
import { getSubscriptionFeed, searchVideos } from '@/services/youtubeService'
import type { Page, Video } from '@/types/youtube'

const STALE = 30 * 60_000
const isSettled = (q: { isPending: boolean; fetchStatus: string }) => !q.isPending || q.fetchStatus === 'idle'

/**
 * Personalised Shorts feed. Candidates: new uploads from subscribed channels, a keyword search built from
 * the viewer's interests (one extra search.list), and the generic short-video search (paged). They are
 * ranked by the same RecommendationService as Home. Order is frozen per page so the list doesn't reshuffle
 * under the viewer; later pages are ranked and appended.
 */
export function useShortsFeed() {
  const { userId, isSignedIn } = useAuth()
  const { settings } = useSettings()
  const region = settings.region
  const rec = useRecommendationContext()
  const subs = useSubscriptions()
  const channelIds = useMemo(() => (subs.data ?? []).slice(0, 15).map((s) => s.youtube_channel_id), [subs.data])

  const feed = useQuery({
    queryKey: qk.feed(userId ?? 'anon', channelIds),
    queryFn: () => getSubscriptionFeed(channelIds, 4),
    enabled: isSignedIn && channelIds.length > 0,
    staleTime: 10 * 60_000,
  })

  const interests = rec.personalized ? rec.profile.preferred_keywords.slice(0, 2).join(' ') : ''
  const personal = useQuery({
    queryKey: qk.search('shorts-personal', { interests, region }),
    queryFn: () => searchVideos({ q: `${interests} #shorts`, videoDuration: 'short', regionCode: region }),
    enabled: !!interests,
    staleTime: STALE,
    retry: false,
  })

  const list = useInfiniteList<Page<Video>>(qk.search('shorts', region), (pageToken) => searchVideos({ q: '#shorts', videoDuration: 'short', regionCode: region, pageToken }))

  const settled = !rec.loading && isSettled(feed) && isSettled(personal)
  const pages = list.data?.pages

  const shorts = useMemo(() => {
    if (!settled || !pages || pages.length === 0) return []
    const used = new Set<string>()
    const out: Video[] = []
    const rankInto = (pool: readonly Video[]) => {
      const fresh = pool.filter((v) => isShortVideo(v) && !used.has(v.id))
      for (const r of recommender.rank(fresh, rec.ctx, { limit: fresh.length })) {
        used.add(r.video.id)
        out.push(r.video)
      }
    }
    rankInto([...(feed.data ?? []), ...(personal.data?.items ?? []), ...(pages[0]?.items ?? [])])
    for (const page of pages.slice(1)) rankInto(page.items)
    return out
  }, [settled, pages, feed.data, personal.data, rec.ctx])

  return {
    shorts,
    loading: list.isPending || !settled,
    error: list.isError && shorts.length === 0 ? list.error : null,
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: list.fetchNextPage,
    refetch: list.refetch,
    personalized: rec.personalized,
  }
}
