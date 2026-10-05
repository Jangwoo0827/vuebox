import { Globe, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PlaylistWithCount } from '@/services/playlistService'

/** Cover = thumbnail of the first video (public i.ytimg.com URL, no API call needed). */
export const coverUrl = (videoId: string | null) => (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null)

export function PlaylistCard({ playlist }: { playlist: PlaylistWithCount }) {
  const cover = coverUrl(playlist.cover_video_id)
  return (
    <article className="group relative flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-2">
        {cover && <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />}
        <span className="absolute inset-y-0 right-0 flex w-1/3 items-center justify-center bg-black/70 text-sm font-semibold text-white">{playlist.item_count}개</span>
      </div>
      <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">
        <Link to={`/playlist/${playlist.id}`} className="after:absolute after:inset-0 after:content-['']">
          {playlist.title}
        </Link>
      </h3>
      <p className="flex items-center gap-1 text-sm text-text-secondary">
        {playlist.visibility === 'public' ? <Globe className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
        {playlist.visibility === 'public' ? '공개' : '비공개'}
      </p>
    </article>
  )
}
