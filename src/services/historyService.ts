import { supabase } from '@/lib/supabase'
import type { SearchHistoryRow, WatchHistoryRow } from '@/types/db'
import type { Video } from '@/types/youtube'
import { check, unwrap } from './db'

// ---------------------------------------------------------------------------
// Watch history
// ---------------------------------------------------------------------------
export interface ProgressSnapshot {
  video: Video
  progressSeconds: number
  durationSeconds: number
  watchedSeconds: number
  completed: boolean
  startedAt?: string
}

/** Percentage helper shared by tracking + UI. */
export const toPercentage = (progress: number, duration: number) =>
  duration > 0 ? Math.min(100, Math.max(0, Math.round((progress / duration) * 10000) / 100)) : 0

/** One row per (user, video): upsert keeps history from growing on every save. */
export async function saveProgress(userId: string, s: ProgressSnapshot): Promise<void> {
  const pct = s.completed ? 100 : toPercentage(s.progressSeconds, s.durationSeconds)
  const now = new Date().toISOString()
  check(
    await supabase.from('watch_history').upsert(
      {
        user_id: userId,
        video_id: s.video.id,
        title_snapshot: s.video.title,
        thumbnail_snapshot: s.video.thumbnail,
        channel_id_snapshot: s.video.channelId,
        channel_name_snapshot: s.video.channelTitle,
        category_id_snapshot: s.video.categoryId,
        duration_seconds: Math.round(s.durationSeconds),
        progress_seconds: Math.round(s.progressSeconds),
        watch_percentage: pct,
        watched_seconds: Math.round(s.watchedSeconds),
        completed: s.completed,
        last_watched_at: now,
        snapshot_updated_at: now,
        ...(s.startedAt ? { started_at: s.startedAt } : {}),
      },
      { onConflict: 'user_id,video_id' },
    ),
  )
}

export async function getHistoryEntry(userId: string, videoId: string): Promise<WatchHistoryRow | null> {
  return unwrap(await supabase.from('watch_history').select('*').eq('user_id', userId).eq('video_id', videoId).maybeSingle())
}

export async function listHistory(userId: string, limit = 50, before?: string): Promise<WatchHistoryRow[]> {
  let q = supabase.from('watch_history').select('*').eq('user_id', userId).order('last_watched_at', { ascending: false }).limit(limit)
  if (before) q = q.lt('last_watched_at', before)
  return unwrap(await q)
}

/** Unfinished videos (1–94%) the user can resume. */
export async function listContinueWatching(userId: string, limit = 12): Promise<WatchHistoryRow[]> {
  return unwrap(
    await supabase
      .from('watch_history')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', false)
      .gte('progress_seconds', 5)
      .lt('watch_percentage', 95)
      .order('last_watched_at', { ascending: false })
      .limit(limit),
  )
}

export async function deleteHistoryEntry(userId: string, id: string): Promise<void> {
  check(await supabase.from('watch_history').delete().eq('user_id', userId).eq('id', id))
}

export async function clearHistory(userId: string): Promise<void> {
  check(await supabase.from('watch_history').delete().eq('user_id', userId))
}

/** Rows used for stats (last 1000 entries). */
export async function listHistoryForStats(userId: string): Promise<WatchHistoryRow[]> {
  return unwrap(await supabase.from('watch_history').select('*').eq('user_id', userId).order('last_watched_at', { ascending: false }).limit(1000))
}

// ---------------------------------------------------------------------------
// Search history
// ---------------------------------------------------------------------------
export async function listSearchHistory(userId: string, limit = 10): Promise<SearchHistoryRow[]> {
  return unwrap(
    await supabase.from('search_history').select('id, query, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
  )
}

export async function saveSearch(userId: string, query: string): Promise<void> {
  const q = query.trim().slice(0, 100)
  if (!q) return
  check(await supabase.from('search_history').upsert({ user_id: userId, query: q, created_at: new Date().toISOString() }, { onConflict: 'user_id,query' }))
}

export async function deleteSearch(userId: string, id: string): Promise<void> {
  check(await supabase.from('search_history').delete().eq('user_id', userId).eq('id', id))
}

export async function clearSearchHistory(userId: string): Promise<void> {
  check(await supabase.from('search_history').delete().eq('user_id', userId))
}
