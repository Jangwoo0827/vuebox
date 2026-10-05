import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { DISCOVER_CATEGORIES } from '@/constants/categories'
import { hasSignal } from '@/features/recommendations/profile'
import { recommender } from '@/features/recommendations/ranker'
import { signalQueue } from '@/features/recommendations/signalQueue'
import { useRecommendationContext } from '@/features/recommendations/useRecommendationContext'
import { useAuth } from '@/hooks/useAuth'
import { useSearchHistory } from '@/hooks/useSearchHistory'
import { useSettings } from '@/hooks/useSettings'
import { useSubscriptions } from '@/hooks/useLibrary'
import { qk } from '@/lib/queryKeys'
import { createNotification } from '@/services/notificationService'
import { getChannelVideos, getSubscriptionFeed, getTrendingVideos, searchVideos } from '@/services/youtubeService'
import type { Video } from '@/types/youtube'

export interface Section {
  videos: Video[]
  loading: boolean
  error: unknown
}

const STALE = 30 * 60_000
const MAX_SUB_CHANNELS = 15
const shownThisSession = new Set<string>()

const isSettled = (q: { isPending: boolean; fetchStatus: string }) => !q.isPending || q.fetchStatus === 'idle'

/**
 * Builds every Home section from a small, shared set of cheap API calls (quota-aware):
 *   mostPopular charts (1 unit each), channel uploads (1–2 units), and at most ONE search.list (100 units)
 * — never one search per section. Ranking happens locally in the RecommendationService.
 */
export function useHomeFeeds() {
  const { userId, isSignedIn } = useAuth()
  const { settings } = useSettings()
  const region = settings.region
  const rec = useRecommendationContext()
  const qc = useQueryClient()
  const { all: searches } = useSearchHistory(1)
  const subs = useSubscriptions()

  const channelIds = useMemo(() => (subs.data ?? []).slice(0, MAX_SUB_CHANNELS).map((s) => s.youtube_channel_id), [subs.data])
  const personalized = rec.personalized

  // Base pool: always available, and what signed-out visitors see.
  const trending = useQuery({
    queryKey: qk.trending(region),
    queryFn: () => getTrendingVideos({ regionCode: region, maxResults: 50 }),
    staleTime: STALE,
  })

  // Subscription uploads: one server call for up to 15 channels.
  const feed = useQuery({
    queryKey: qk.feed(userId ?? 'anon', channelIds),
    queryFn: () => getSubscriptionFeed(channelIds, 4),
    enabled: isSignedIn && channelIds.length > 0,
    staleTime: 10 * 60_000,
  })

  // Personalised pools: charts of the user's favourite categories.
  const topCategories = personalized ? rec.profile.preferred_categories.slice(0, 2) : []
  const categoryPools = useQueries({
    queries: topCategories.map((categoryId) => ({
      queryKey: qk.trending(region, categoryId),
      queryFn: () => getTrendingVideos({ regionCode: region, categoryId, maxResults: 30 }),
      staleTime: STALE,
    })),
  })

  // Exactly one search for "Based on Your Searches": the newest search, else the strongest keywords.
  const searchQuery = useMemo(() => {
    if (!personalized) return ''
    if (searches[0]) return searches[0].query
    return rec.profile.preferred_keywords.slice(0, 2).join(' ')
  }, [personalized, searches, rec.profile.preferred_keywords])
  const searchPool = useQuery({
    queryKey: qk.search('home', searchQuery),
    queryFn: () => searchVideos({ q: searchQuery, regionCode: region }),
    enabled: !!searchQuery,
    staleTime: STALE,
    retry: false, // never burn quota on retries
  })

  // "Because you watched": same channel + same category as the latest well-watched video.
  const seed = personalized ? rec.ctx.seeds[0] : undefined
  const seedUploads = useQuery({
    queryKey: qk.channelVideos(seed?.channelId ?? 'none'),
    queryFn: () => getChannelVideos({ channelId: seed!.channelId!, maxResults: 20 }),
    enabled: !!seed?.channelId && /^UC[\w-]{22}$/.test(seed.channelId),
    staleTime: STALE,
  })
  const seedCategory = useQuery({
    queryKey: qk.trending(region, seed?.categoryId ?? 'none'),
    queryFn: () => getTrendingVideos({ regionCode: region, categoryId: seed!.categoryId!, maxResults: 30 }),
    enabled: !!seed?.categoryId,
    staleTime: STALE,
  })

  // "Discover something new": a chart from a category the user hasn't been watching, rotating daily.
  const discoverCategory = useMemo(() => {
    const known = new Set(rec.profile.preferred_categories)
    const charts = DISCOVER_CATEGORIES.filter((c) => c.source.kind === 'chart' && !known.has(c.source.categoryId))
    return charts[Math.floor(Date.now() / 86_400_000) % charts.length] ?? DISCOVER_CATEGORIES[0]!
  }, [rec.profile.preferred_categories])
  const discoverId = discoverCategory.source.kind === 'chart' ? discoverCategory.source.categoryId : '24'
  const discover = useQuery({
    queryKey: qk.trending(region, discoverId),
    queryFn: () => getTrendingVideos({ regionCode: region, categoryId: discoverId, maxResults: 20 }),
    staleTime: STALE,
  })

  // Rank only once every pool has settled so the feed doesn't reshuffle while pools trickle in.
  const poolsSettled = !rec.loading && [trending, feed, searchPool, seedUploads, seedCategory, ...categoryPools].every(isSettled)

  const categoryData = categoryPools.map((q) => q.data)
  const sections = useMemo(() => {
    const trendingVideos = trending.data?.items ?? []
    const claimed = new Set<string>()
    const take = (list: readonly Video[], n: number): Video[] => {
      const out: Video[] = []
      for (const v of list) {
        if (out.length >= n) break
        if (claimed.has(v.id) || !v.embeddable) continue
        claimed.add(v.id)
        out.push(v)
      }
      return out
    }

    let forYou: Video[] = []
    if (personalized && poolsSettled) {
      const pool = [...(feed.data ?? []), ...categoryData.flatMap((d) => d?.items ?? []), ...(searchPool.data?.items ?? []), ...trendingVideos]
      forYou = take(recommender.rank(pool, rec.ctx, { limit: 24 }).map((r) => r.video), 24)
    }

    let because: Video[] = []
    if (personalized && poolsSettled && seed) {
      const pool = [...(seedUploads.data?.items ?? []), ...(seedCategory.data?.items ?? [])]
      because = take(
        recommender.rank(pool, { ...rec.ctx, seeds: [{ ...seed, strength: 1 }], excludeIds: new Set([seed.videoId, ...claimed]) }, { limit: 12 }).map((r) => r.video),
        12,
      )
    }

    return {
      forYou,
      because,
      basedOnSearch: personalized && poolsSettled ? take(searchPool.data?.items ?? [], 12) : [],
      fromSubs: take(feed.data ?? [], 12),
      trending: take(trendingVideos, 12),
      popular: take([...trendingVideos].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0)), 12),
      latest: take([...trendingVideos].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), 12),
      discover: take(discover.data?.items ?? [], 12),
    }
    // categoryData is a fresh array each render; its members are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalized, poolsSettled, trending.data, feed.data, searchPool.data, seedUploads.data, seedCategory.data, discover.data, rec.ctx, seed, ...categoryData])

  // Log what we showed (once per video per session) so "recently shown" can be down-ranked next time.
  useEffect(() => {
    if (!personalized || sections.forYou.length === 0) return
    for (const v of sections.forYou.slice(0, 12)) {
      if (shownThisSession.has(v.id)) continue
      shownThisSession.add(v.id)
      signalQueue.addEvent({ videoId: v.id, type: 'impression' })
    }
  }, [personalized, sections.forYou])

  // One "new recommendation" notification per day (deduped by a unique index).
  useEffect(() => {
    const top = sections.forYou[0]
    if (!userId || !settings.notifications_enabled || !top || !hasSignal(rec.profile)) return
    const day = new Date().toISOString().slice(0, 10)
    void createNotification(userId, { type: 'recommendation', title: '회원님을 위한 새 추천', message: top.title, referenceId: `rec-${day}:${top.id}` })
      .then(() => qc.invalidateQueries({ queryKey: qk.notifications(userId) }))
      .catch(() => undefined)
  }, [userId, settings.notifications_enabled, sections.forYou, rec.profile, qc])

  // New uploads from subscribed channels become notifications (at most 3 per load, last 3 days).
  useEffect(() => {
    if (!userId || !settings.notifications_enabled || !feed.data) return
    const recent = feed.data.filter((v) => Date.now() - Date.parse(v.publishedAt) < 3 * 86_400_000).slice(0, 3)
    if (recent.length === 0) return
    void Promise.all(recent.map((v) => createNotification(userId, { type: 'subscription', title: `${v.channelTitle}의 새 영상`, message: v.title, referenceId: v.id })))
      .then(() => qc.invalidateQueries({ queryKey: qk.notifications(userId) }))
      .catch(() => undefined)
  }, [userId, settings.notifications_enabled, feed.data, qc])

  const baseLoading = trending.isPending
  const personalLoading = personalized && !poolsSettled
  const wrap = (videos: Video[], loading: boolean, error: unknown = null): Section => ({ videos, loading, error })

  return {
    region,
    personalized,
    searchQuery,
    becauseTitle: seed?.title ?? '',
    discoverLabel: discoverCategory.label,
    forYou: wrap(sections.forYou, personalLoading),
    because: wrap(sections.because, personalLoading),
    basedOnSearch: wrap(sections.basedOnSearch, personalLoading, searchPool.error),
    fromSubscriptions: wrap(sections.fromSubs, feed.isPending && feed.fetchStatus !== 'idle', feed.error),
    trending: wrap(sections.trending, baseLoading, trending.error),
    popular: wrap(sections.popular, baseLoading, trending.error),
    latest: wrap(sections.latest, baseLoading, trending.error),
    discover: wrap(sections.discover, discover.isPending, discover.error),
  }
}
