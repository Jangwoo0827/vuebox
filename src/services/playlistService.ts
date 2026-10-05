import { supabase } from '@/lib/supabase'
import type { PlaylistItemRow, PlaylistRow, Visibility } from '@/types/db'
import type { Video } from '@/types/youtube'
import { check, isUniqueViolation, unwrap } from './db'

export interface PlaylistWithCount extends PlaylistRow {
  item_count: number
  cover_video_id: string | null
}

export async function listPlaylists(userId: string): Promise<PlaylistWithCount[]> {
  const rows = unwrap<(PlaylistRow & { playlist_items: { video_id: string; position: number }[] })[]>(
    await supabase
      .from('playlists')
      .select('*, playlist_items(video_id, position)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  )
  return rows.map(({ playlist_items, ...p }) => ({
    ...p,
    item_count: playlist_items.length,
    cover_video_id: [...playlist_items].sort((a, b) => a.position - b.position)[0]?.video_id ?? null,
  }))
}

/** RLS returns the playlist for its owner, or for anyone when it's public. */
export async function getPlaylist(id: string): Promise<PlaylistRow | null> {
  return unwrap(await supabase.from('playlists').select('*').eq('id', id).maybeSingle())
}

export async function listPlaylistItems(playlistId: string): Promise<PlaylistItemRow[]> {
  return unwrap(await supabase.from('playlist_items').select('*').eq('playlist_id', playlistId).order('position', { ascending: true }))
}

export async function createPlaylist(userId: string, title: string, description = '', visibility: Visibility = 'private'): Promise<PlaylistRow> {
  return unwrap(await supabase.from('playlists').insert({ user_id: userId, title: title.trim(), description: description.trim(), visibility }).select('*').single())
}

export async function updatePlaylist(id: string, patch: Partial<Pick<PlaylistRow, 'title' | 'description' | 'visibility'>>): Promise<PlaylistRow> {
  return unwrap(await supabase.from('playlists').update(patch).eq('id', id).select('*').single())
}

export async function deletePlaylist(id: string): Promise<void> {
  check(await supabase.from('playlists').delete().eq('id', id))
}

/** Returns false when the video was already in the playlist. Position is assigned by a DB trigger. */
export async function addToPlaylist(playlistId: string, video: Video): Promise<boolean> {
  try {
    check(
      await supabase.from('playlist_items').insert({
        playlist_id: playlistId,
        video_id: video.id,
        title_snapshot: video.title,
        thumbnail_snapshot: video.thumbnail.startsWith('https://') ? video.thumbnail : null,
        channel_name_snapshot: video.channelTitle,
        position: null,
      }),
    )
    await supabase.from('playlists').update({ updated_at: new Date().toISOString() }).eq('id', playlistId)
    return true
  } catch (e) {
    if (isUniqueViolation(e)) return false
    throw e
  }
}

export async function removeFromPlaylist(itemId: string): Promise<void> {
  check(await supabase.from('playlist_items').delete().eq('id', itemId))
}

/** Persist a new order in a single round trip. */
export async function reorderPlaylist(playlistId: string, orderedItemIds: string[]): Promise<void> {
  check(await supabase.rpc('reorder_playlist_items', { p_playlist_id: playlistId, p_item_ids: orderedItemIds }))
}

/** Which of the user's playlists already contain this video? */
export async function playlistsContaining(userId: string, videoId: string): Promise<string[]> {
  const rows = unwrap(await supabase.from('playlist_items').select('playlist_id, playlists!inner(user_id)').eq('video_id', videoId).eq('playlists.user_id', userId))
  return rows.map((r) => r.playlist_id as string)
}
