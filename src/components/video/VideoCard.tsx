import { memo } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { signalQueue } from '@/features/recommendations/signalQueue'
import type { Video } from '@/types/youtube'
import { formatDuration, formatRelativeTime, formatViews } from '@/utils/format'

export function DurationBadge({ video }: { video: Pick<Video, 'durationSeconds' | 'live'> }) {
  if (video.live === 'live') return <span className="absolute bottom-2 right-2 rounded bg-danger px-1.5 py-0.5 text-xs font-bold text-white">LIVE</span>
  if (video.durationSeconds <= 0) return null
  return <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">{formatDuration(video.durationSeconds)}</span>
}

interface Props {
  video: Video
  avatar?: string
  /** 0–100: renders a resume progress bar. */
  progress?: number
  /** Optional context for list ordering, e.g. the playlist being played. */
  playlistId?: string
}

/** The whole card is clickable via a stretched link on the title; the channel link stays separately focusable. */
function VideoCardBase({ video, avatar, progress, playlistId }: Props) {
  const href = `/watch/${video.id}${playlistId ? `?list=${playlistId}` : ''}`
  return (
    <article className="group relative flex flex-col gap-3 rounded-lg transition-transform duration-150 hover:-translate-y-0.5">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-2">
        <img src={video.thumbnail} alt="" width={320} height={180} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
        <DurationBadge video={video} />
        {progress !== undefined && progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="시청 진행률">
            <div className="h-full bg-accent" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <Avatar src={avatar} name={video.channelTitle} size={36} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">
            <Link to={href} onClick={() => signalQueue.addEvent({ videoId: video.id, type: 'click' })} className="outline-offset-4 after:absolute after:inset-0 after:content-['']">
              {video.title}
            </Link>
          </h3>
          <Link to={`/channel/${video.channelId}`} className="relative z-10 mt-0.5 block truncate text-sm text-text-secondary hover:text-text">
            {video.channelTitle}
          </Link>
          <p className="truncate text-sm text-text-secondary">{[formatViews(video.viewCount), formatRelativeTime(video.publishedAt)].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
    </article>
  )
}

export const VideoCard = memo(VideoCardBase)
