import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { qk } from '@/lib/queryKeys'
import { createNotification } from '@/services/notificationService'
import { useAuth } from './useAuth'
import { useVideoRefs } from './useLibrary'
import { useSettings } from './useSettings'

const WEEK_MS = 7 * 86_400_000

function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const week = Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Weekly "Watch Later" reminder. (Subscription / playlist / recommendation notifications are created where those events happen.) */
export function useAutoNotifications() {
  const { userId } = useAuth()
  const { settings } = useSettings()
  const { data: later } = useVideoRefs('watch_later')
  const qc = useQueryClient()

  useEffect(() => {
    if (!userId || !settings.notifications_enabled || !later) return
    const stale = later.filter((r) => Date.now() - Date.parse(r.created_at) > WEEK_MS)
    if (stale.length === 0) return
    void createNotification(userId, {
      type: 'reminder',
      title: '나중에 볼 영상이 기다리고 있어요',
      message: `일주일 넘게 저장해 둔 영상이 ${stale.length}개 있습니다.`,
      referenceId: `watch-later-${isoWeekKey(new Date())}`,
    })
      .then(() => qc.invalidateQueries({ queryKey: qk.notifications(userId) }))
      .catch(() => undefined)
  }, [userId, settings.notifications_enabled, later, qc])
}
