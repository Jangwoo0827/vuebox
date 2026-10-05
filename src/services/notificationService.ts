import { supabase } from '@/lib/supabase'
import type { NotificationRow, NotificationType } from '@/types/db'
import { check, isUniqueViolation, unwrap } from './db'

export async function listNotifications(userId: string, limit = 30): Promise<NotificationRow[]> {
  return unwrap(
    await supabase
      .from('notifications')
      .select('id, type, title, message, reference_id, read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  )
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  check(await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('id', id))
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  check(await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false))
}

export async function deleteNotification(userId: string, id: string): Promise<void> {
  check(await supabase.from('notifications').delete().eq('user_id', userId).eq('id', id))
}

/** Idempotent per (type, reference): a unique index drops duplicates, which we treat as success. */
export async function createNotification(
  userId: string,
  n: { type: NotificationType; title: string; message?: string; referenceId?: string },
): Promise<void> {
  try {
    check(
      await supabase.from('notifications').insert({
        user_id: userId,
        type: n.type,
        title: n.title.slice(0, 120),
        message: (n.message ?? '').slice(0, 500),
        reference_id: n.referenceId ?? null,
      }),
    )
  } catch (e) {
    if (!isUniqueViolation(e)) throw e
  }
}
