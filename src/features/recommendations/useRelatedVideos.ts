import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSettings } from '@/hooks/useSettings'
import { qk } from '@/lib/queryKeys'
import { getChannelVideos, getTrendingVideos } from '@/services/youtubeService'
import type { Video } from '@/types/youtube'
import { recommender } from './ranker'
import { extractKeywords } from './text'
import { useRecommendationContext } from './useRecommendationContext'

/**
 * "Related" videos without YouTube's (discontinued) related endpoint and without search.list:
 * candidates = the channel's recent uploads + the category's popular chart (2–3 quota units total),
 * ranked by similarity to the current video plus the viewer's own profile.
 */
export function useRelatedVideos(video: Video | undefined, limit = 20) {
  const { settings } = useSettings()
  const rec = useRecommendationContext()
  const region = settings.region

  const uploads = useQuery({
    queryKey: qk.channelVideos(video?.channelId ?? 'none'),
    queryFn: () => getChannelVideos({ channelId: video!.channelId, maxResults: 20 }),
    enabled: !!video?.channelId,
    staleTime: 30 * 60_000,
  })
  const chart = useQuery({
    queryKey: qk.trending(region, video?.categoryId ?? 'none'),
    queryFn: () => getTrendingVideos({ regionCode: region, categoryId: video!.categoryId!, maxResults: 30 }),
    enabled: !!video?.categoryId,
    staleTime: 30 * 60_000,
  })

  const videos = useMemo<Video[]>(() => {
    if (!video) return []
    const pool = [...(uploads.data?.items ?? []), ...(chart.data?.items ?? [])]
    const seed = { videoId: video.id, title: video.title, channelId: video.channelId, categoryId: video.categoryId, keywords: extractKeywords(video.title, video.tags), strength: 1 }
    return recommender.rank(pool, { ...rec.ctx, seeds: [seed, ...rec.ctx.seeds], excludeIds: new Set([video.id]) }, { limit }).map((r) => r.video)
  }, [video, uploads.data, chart.data, rec.ctx, limit])

  return { videos, isLoading: uploads.isPending || chart.isPending, error: uploads.error && chart.error ? uploads.error : null }
}
