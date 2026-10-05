import { emptyProfile, type RecommendationProfile } from '@/features/recommendations/profile'
import { RECENTLY_SHOWN_HOURS } from '@/features/recommendations/config'
import { supabase } from '@/lib/supabase'
import type { RecommendationEventType, RecommendationProfileRow } from '@/types/db'
import { check, unwrap } from './db'

export async function getRecommendationProfile(userId: string): Promise<RecommendationProfile> {
  const row = unwrap<RecommendationProfileRow | null>(await supabase.from('recommendation_profiles').select('*').eq('user_id', userId).maybeSingle())
  return row ?? emptyProfile()
}

export async function saveRecommendationProfile(userId: string, p: RecommendationProfile): Promise<void> {
  check(await supabase.from('recommendation_profiles').upsert({ user_id: userId, ...p }, { onConflict: 'user_id' }))
}

export interface RecommendationEvent {
  videoId: string
  type: RecommendationEventType
}

/** Minimal behavioural log: (user, video, type, timestamp). Nothing else is collected. */
export async function recordEvents(userId: string, events: RecommendationEvent[]): Promise<void> {
  if (events.length === 0) return
  check(await supabase.from('recommendation_events').insert(events.map((e) => ({ user_id: userId, video_id: e.videoId, event_type: e.type }))))
}

export async function listRecentImpressions(userId: string, hours = RECENTLY_SHOWN_HOURS): Promise<string[]> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString()
  const rows = unwrap<{ video_id: string }[]>(
    await supabase
      .from('recommendation_events')
      .select('video_id')
      .eq('user_id', userId)
      .eq('event_type', 'impression')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(300),
  )
  return [...new Set(rows.map((r) => r.video_id))]
}
