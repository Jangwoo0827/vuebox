import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscriptions } from '@/hooks/useLibrary'
import { useSettings } from '@/hooks/useSettings'
import { qk } from '@/lib/queryKeys'
import { listHistory } from '@/services/historyService'
import { getRecommendationProfile, listRecentImpressions } from '@/services/recommendationService'
import { SEED_COUNT } from './config'
import { emptyProfile, watchInterestWeight, type RecommendationProfile } from './profile'
import type { RankingContext, SeedVideo } from './ranker'
import { extractKeywords } from './text'

export interface RecommendationState {
  ctx: RankingContext
  profile: RecommendationProfile
  /** True while the signed-in user's data is still loading (don't render a ranking yet). */
  loading: boolean
  personalized: boolean
}

const EMPTY_PROFILE = emptyProfile(new Date(0))

/** Gathers everything the recommender needs from Supabase (profile, history, impressions, subscriptions). */
export function useRecommendationContext(): RecommendationState {
  const { userId } = useAuth()
  const { settings, isLoading: settingsLoading } = useSettings()
  const personalized = !!userId && settings.personalization
  const enabled = personalized

  const profileQ = useQuery({ queryKey: qk.recProfile(userId ?? 'anon'), queryFn: () => getRecommendationProfile(userId!), enabled, staleTime: 5 * 60_000 })
  const historyQ = useQuery({ queryKey: [...qk.history(userId ?? 'anon'), 'context'], queryFn: () => listHistory(userId!, 100), enabled, staleTime: 5 * 60_000 })
  const shownQ = useQuery({ queryKey: qk.impressions(userId ?? 'anon'), queryFn: () => listRecentImpressions(userId!), enabled, staleTime: 5 * 60_000 })
  const subsQ = useSubscriptions()

  const profile = enabled ? (profileQ.data ?? EMPTY_PROFILE) : EMPTY_PROFILE

  const ctx = useMemo<RankingContext>(() => {
    const rows = enabled ? (historyQ.data ?? []) : []
    const watched = new Map(rows.map((r) => [r.video_id, r.completed ? 100 : r.watch_percentage]))
    const seeds: SeedVideo[] = rows
      .filter((r) => r.watch_percentage >= 25 && r.title_snapshot)
      .slice(0, SEED_COUNT)
      .map((r) => ({
        videoId: r.video_id,
        title: r.title_snapshot ?? undefined,
        channelId: r.channel_id_snapshot,
        categoryId: r.category_id_snapshot,
        keywords: extractKeywords(r.title_snapshot ?? ''),
        strength: Math.min(1, Math.max(0.1, watchInterestWeight(r.watch_percentage) / 3)),
      }))
    return {
      profile,
      watched,
      seeds,
      recentlyShown: new Set(enabled ? (shownQ.data ?? []) : []),
      subscribedChannelIds: new Set((subsQ.data ?? []).map((s) => s.youtube_channel_id)),
    }
  }, [enabled, historyQ.data, shownQ.data, subsQ.data, profile])

  return {
    ctx,
    profile,
    personalized,
    loading: settingsLoading || (enabled && (profileQ.isPending || historyQ.isPending)),
  }
}
