import { memo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { signalQueue } from '@/features/recommendations/signalQueue'
import type { Video } from '@/types/youtube'
import { formatRelativeTime, formatViews } from '@/utils/format'
import { DurationBadge } from './VideoCard'

interface Props {
  video: Video
  /** Show the description snippet (search results). */
  showDescription?: boolean
  playlistId?: string
  active?: boolean
  actions?: ReactNode
  progress?: number
}

function VideoRowBase({ video, showDescription, playlistId, active, actions, progress }: Props) {
  const href = `/watch/${video.id}${playlistId ? `?list=${playlistId}` : ''}`
  return (
    <article className={`group relative flex gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface ${active ? 'bg-accent-soft' : ''}`}>
      <div className={`relative aspect-video shrink-0 overflow-hidden rounded-lg bg-surface-2 ${showDescription ? 'w-40 sm:w-64' : 'w-36 sm:w-40'}`}>
        <img src={video.thumbnail} alt="" width={320} height={180} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full object-cover" />
        <DurationBadge video={video} />
        {progress !== undefined && progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
            <div className="h-full bg-accent" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className={`line-clamp-2 font-semibold leading-snug ${showDescription ? 'text-base sm:text-lg' : 'text-sm'}`}>
          <Link to={href} onClick={() => signalQueue.addEvent({ videoId: video.id, type: 'click' })} aria-current={active ? 'true' : undefined} className="after:absolute after:inset-0 after:content-['']">
            {video.title}
          </Link>
        </h3>
        <p className="mt-1 truncate text-xs text-text-secondary sm:text-sm">
          <Link to={`/channel/${video.channelId}`} className="relative z-10 hover:text-text">
            {video.channelTitle}
          </Link>
        </p>
        <p className="truncate text-xs text-text-secondary sm:text-sm">{[formatViews(video.viewCount), formatRelativeTime(video.publishedAt)].filter(Boolean).join(' · ')}</p>
        {showDescription && video.description && <p className="mt-2 hidden line-clamp-2 text-sm text-text-secondary sm:block">{video.description}</p>}
      </div>
      {actions && <div className="relative z-10 flex shrink-0 items-start">{actions}</div>}
    </article>
  )
}

export const VideoRow = memo(VideoRowBase)
