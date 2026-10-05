import { supabase } from '@/lib/supabase'
import type { SubscriptionRow, VideoRef } from '@/types/db'
import { check, isUniqueViolation, unwrap } from './db'

/** The three "saved video" lists share one shape: (user_id, video_id). */
export type VideoListTable = 'watch_later' | 'favorites' | 'video_likes'

export async function listVideoRefs(table: VideoListTable, userId: string, limit = 200): Promise<VideoRef[]> {
  return unwrap(
    await supabase.from(table).select('id, video_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
  )
}

export async function addVideoRef(table: VideoListTable, userId: string, videoId: string): Promise<void> {
  try {
    check(await supabase.from(table).insert({ user_id: userId, video_id: videoId }))
  } catch (e) {
    if (!isUniqueViolation(e)) throw e // already saved is fine
  }
}

export async function removeVideoRef(table: VideoListTable, userId: string, videoId: string): Promise<void> {
  check(await supabase.from(table).delete().eq('user_id', userId).eq('video_id', videoId))
}

// ---------------------------------------------------------------------------
// VUEBOX-internal channel subscriptions
// ---------------------------------------------------------------------------
export async function listSubscriptions(userId: string): Promise<SubscriptionRow[]> {
  return unwrap(
    await supabase
      .from('subscriptions')
      .select('id, youtube_channel_id, channel_name, avatar_url, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
  )
}

export async function subscribe(userId: string, channel: { id: string; title: string; avatar: string }): Promise<void> {
  try {
    check(
      await supabase.from('subscriptions').insert({
        user_id: userId,
        youtube_channel_id: channel.id,
        channel_name: channel.title.slice(0, 200) || 'Channel',
        avatar_url: channel.avatar.startsWith('https://') ? channel.avatar : null,
      }),
    )
  } catch (e) {
    if (!isUniqueViolation(e)) throw e
  }
}

export async function unsubscribe(userId: string, channelId: string): Promise<void> {
  check(await supabase.from('subscriptions').delete().eq('user_id', userId).eq('youtube_channel_id', channelId))
}
