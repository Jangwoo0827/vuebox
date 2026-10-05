import { Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { WatchHistoryRow } from '@/types/db'
import type { Video } from '@/types/youtube'
import { formatDuration, formatRelativeTime } from '@/utils/format'

interface Props {
  entry: WatchHistoryRow
  /** Fresh metadata; the stored snapshot is only a fallback (YouTube data must not go stale). */
  video?: Video
  onRemove?: () => void
}

export function HistoryItem({ entry, video, onRemove }: Props) {
  const title = video?.title ?? entry.title_snapshot ?? '제목을 불러올 수 없는 영상'
  const channel = video?.channelTitle ?? entry.channel_name_snapshot ?? ''
  const thumb = video?.thumbnail ?? entry.thumbnail_snapshot ?? `https://i.ytimg.com/vi/${entry.video_id}/mqdefault.jpg`
  const pct = Math.round(entry.watch_percentage)

  return (
    <article className="group relative flex gap-3 rounded-lg p-1.5 hover:bg-surface">
      <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-52">
        <img src={thumb} alt="" width={320} height={180} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">{formatDuration(entry.duration_seconds)}</span>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 font-semibold leading-snug">
          <Link to={`/watch/${entry.video_id}`} className="after:absolute after:inset-0 after:content-['']">
            {title}
          </Link>
        </h3>
        <p className="truncate text-sm text-text-secondary">{channel}</p>
        <p className="text-sm text-text-secondary">
          {entry.completed ? '시청 완료' : `${pct}% 시청`} · {formatRelativeTime(entry.last_watched_at)}
        </p>
      </div>
      {onRemove && (
        <button type="button" className="icon-btn relative z-10 shrink-0 text-text-secondary" aria-label={`${title} 기록에서 삭제`} onClick={onRemove}>
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </article>
  )
}
