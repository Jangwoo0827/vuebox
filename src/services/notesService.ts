import { supabase } from '@/lib/supabase'
import type { VideoNoteRow } from '@/types/db'
import { check, unwrap } from './db'

const COLUMNS = 'id, video_id, timestamp_seconds, content, created_at, updated_at'

export async function listNotes(userId: string, videoId: string): Promise<VideoNoteRow[]> {
  return unwrap(await supabase.from('video_notes').select(COLUMNS).eq('user_id', userId).eq('video_id', videoId).order('timestamp_seconds', { ascending: true }))
}

export async function addNote(userId: string, videoId: string, seconds: number, content: string): Promise<VideoNoteRow> {
  return unwrap(
    await supabase
      .from('video_notes')
      .insert({ user_id: userId, video_id: videoId, timestamp_seconds: Math.max(0, Math.floor(seconds)), content: content.trim().slice(0, 1000) })
      .select(COLUMNS)
      .single(),
  )
}

export async function updateNote(userId: string, id: string, content: string): Promise<void> {
  check(await supabase.from('video_notes').update({ content: content.trim().slice(0, 1000) }).eq('user_id', userId).eq('id', id))
}

export async function deleteNote(userId: string, id: string): Promise<void> {
  check(await supabase.from('video_notes').delete().eq('user_id', userId).eq('id', id))
}
