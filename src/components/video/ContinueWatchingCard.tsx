import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import type { WatchHistoryRow } from '@/types/db'
import type { Video } from '@/types/youtube'
import { formatDuration, formatRelativeTime } from '@/utils/format'

interface Props {
  entry: WatchHistoryRow
  /** Fresh metadata (preferred); the stored snapshot is only a fallback. */
  video?: Video
  avatar?: string
}

/** Resume card: thumbnail, title, channel, progress bar and percentage. Clicking resumes from the saved position. */
export function ContinueWatchingCard({ entry, video, avatar }: Props) {
  const title = video?.title ?? entry.title_snapshot ?? '제목 없음'
  const channel = video?.channelTitle ?? entry.channel_name_snapshot ?? ''
  const thumb = video?.thumbnail ?? entry.thumbnail_snapshot
  const pct = Math.round(entry.watch_percentage)

  return (
    <article className="group relative flex w-72 shrink-0 flex-col gap-3 rounded-lg transition-transform duration-150 hover:-translate-y-0.5">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-2">
        {thumb && <img src={thumb} alt="" width={320} height={180} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />}
        <span className="absolute bottom-3 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
          {formatDuration(entry.progress_seconds)} / {formatDuration(entry.duration_seconds)}
        </span>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="시청 진행률">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex gap-3">
        <Avatar src={avatar} name={channel} size={36} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">
            <Link to={`/watch/${entry.video_id}`} className="after:absolute after:inset-0 after:content-['']">
              {title}
            </Link>
          </h3>
          <p className="truncate text-sm text-text-secondary">{channel}</p>
          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-accent">{pct}%</span> 시청 · {formatRelativeTime(entry.last_watched_at)}
          </p>
        </div>
      </div>
    </article>
  )
}
