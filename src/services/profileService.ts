import { AppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Profile, UserSettings } from '@/types/db'
import { check, unwrap } from './db'

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/

export async function getProfile(userId: string): Promise<Profile | null> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle())
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'display_name' | 'username' | 'bio' | 'avatar_url'>>,
): Promise<Profile> {
  const res = await supabase.from('profiles').update(patch).eq('id', userId).select('*').single()
  if (res.error?.code === '23505') throw new AppError('BAD_REQUEST', 'username taken')
  return unwrap(res)
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  if (!USERNAME_RE.test(username)) return false
  const res = await supabase.rpc('username_available', { p_username: username })
  return unwrap(res) === true
}

const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

/** Uploads to avatars/<uid>/<random>.<ext> (storage RLS only allows your own folder) and returns the public URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!AVATAR_TYPES.includes(file.type)) throw new AppError('BAD_REQUEST', 'PNG, JPEG 또는 WebP 이미지만 업로드할 수 있습니다.')
  if (file.size > 2 * 1024 * 1024) throw new AppError('BAD_REQUEST', '이미지는 2MB 이하여야 합니다.')

  const path = `${userId}/${crypto.randomUUID()}.${EXT[file.type]}`
  const up = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (up.error) throw new AppError('SUPABASE', up.error.message)

  // Remove previous avatars so the folder doesn't grow forever.
  const list = await supabase.storage.from('avatars').list(userId)
  const old = (list.data ?? []).filter((f) => `${userId}/${f.name}` !== path).map((f) => `${userId}/${f.name}`)
  if (old.length) await supabase.storage.from('avatars').remove(old)

  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

export async function getSettings(userId: string): Promise<UserSettings | null> {
  return unwrap(await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle())
}

export async function updateSettings(userId: string, patch: Partial<Omit<UserSettings, 'user_id'>>): Promise<UserSettings> {
  return unwrap(await supabase.from('user_settings').update(patch).eq('user_id', userId).select('*').single())
}

/** Server-side account deletion (service role lives in the Edge Function, never here). */
export async function deleteAccount(email: string): Promise<void> {
  const { data: s } = await supabase.auth.getSession()
  if (!s.session) throw new AppError('UNAUTHENTICATED', 'no session')
  const res = await supabase.functions.invoke('delete-account', { body: { confirm: email } })
  if (res.error) throw new AppError('INTERNAL', res.error.message)
}

export async function clearAllUserData(userId: string): Promise<void> {
  // Used by "Delete my data": removes behavioural data but keeps the account.
  const tables = ['watch_history', 'search_history', 'recommendation_events', 'video_notes']
  for (const t of tables) check(await supabase.from(t).delete().eq('user_id', userId))
  check(
    await supabase
      .from('recommendation_profiles')
      .update({ preferred_categories: [], preferred_keywords: [], preferred_channels: [], category_scores: {}, keyword_scores: {}, channel_scores: {}, last_updated_at: new Date().toISOString() })
      .eq('user_id', userId),
  )
}
