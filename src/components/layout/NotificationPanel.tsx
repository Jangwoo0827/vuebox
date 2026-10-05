import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StateViews'
import { useNotifications } from '@/hooks/useNotifications'
import { usePopover } from '@/hooks/usePopover'
import type { NotificationRow } from '@/types/db'
import { formatRelativeTime } from '@/utils/format'

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

/** Where a notification leads: a video for video references, otherwise a sensible page for its type. */
function targetOf(n: NotificationRow): string | null {
  const ref = n.reference_id?.split(':').pop() ?? ''
  if (VIDEO_ID.test(ref)) return `/watch/${ref}`
  if (n.type === 'playlist') return '/playlists'
  if (n.type === 'reminder') return '/watch-later'
  return null
}

export function NotificationPanel() {
  const { open, setOpen, ref } = usePopover()
  const { items, unread, isLoading, isError, markRead, markAllRead, remove } = useNotifications()
  const navigate = useNavigate()

  return (
    <div ref={ref} className="relative">
      <button type="button" data-popover-trigger className="icon-btn relative" aria-label={unread ? `알림 ${unread}개 읽지 않음` : '알림'} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        <Bell className="size-5" aria-hidden />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div role="dialog" aria-label="알림" className="fade-up fixed inset-x-2 top-[calc(var(--topbar-h)+4px)] z-50 flex max-h-[70dvh] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold">알림</h2>
            <button type="button" className="btn btn-ghost !min-h-8 !px-2 text-xs" onClick={() => markAllRead()} disabled={unread === 0}>
              <CheckCheck className="size-4" aria-hidden /> 모두 읽음
            </button>
          </div>
          <div className="overflow-y-auto">
            {isLoading && <LoadingState />}
            {isError && <ErrorState compact message="알림을 불러오지 못했습니다." />}
            {!isLoading && !isError && items.length === 0 && <EmptyState title="새 알림이 없습니다" description="구독 채널의 새 영상과 추천 소식이 여기에 표시됩니다." />}
            <ul>
              {items.map((n) => {
                const target = targetOf(n)
                return (
                  <li key={n.id} className={`flex items-start gap-1 border-b border-border/60 last:border-0 ${n.read ? '' : 'bg-accent-soft/40'}`}>
                    <button
                      type="button"
                      className="min-h-14 flex-1 px-4 py-3 text-left hover:bg-surface-hover"
                      onClick={() => {
                        if (!n.read) markRead(n.id)
                        if (target) {
                          setOpen(false)
                          navigate(target)
                        }
                      }}
                    >
                      <p className={`text-sm ${n.read ? '' : 'font-semibold'}`}>{n.title}</p>
                      {n.message && <p className="mt-0.5 line-clamp-2 text-sm text-text-secondary">{n.message}</p>}
                      <p className="mt-1 text-xs text-text-secondary">{formatRelativeTime(n.created_at)}</p>
                    </button>
                    <button type="button" className="icon-btn mr-1 mt-1 !size-9 text-text-secondary" aria-label="알림 삭제" onClick={() => remove(n.id)}>
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
