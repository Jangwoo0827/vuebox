import { Clock, ListPlus, Share2, Star, ThumbsUp } from 'lucide-react'
import { useState } from 'react'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useVideoToggle } from '@/hooks/useLibrary'
import { toast } from '@/stores/toastStore'
import type { Video } from '@/types/youtube'
import { SaveToPlaylistModal } from './SaveToPlaylistModal'

async function share(video: Video, seconds: number) {
  const url = `${window.location.origin}/watch/${video.id}${seconds > 5 ? `?t=${Math.floor(seconds)}` : ''}`
  try {
    if (navigator.share) await navigator.share({ title: video.title, url })
    else {
      await navigator.clipboard.writeText(url)
      toast.success('링크를 복사했습니다.')
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') toast.error('링크를 공유하지 못했습니다.')
  }
}

/** Like / Favorite / Watch Later / Save / Share. Likes here are VUEBOX likes, not YouTube likes. */
export function VideoActions({ video, getTime }: { video: Video; getTime: () => number }) {
  const like = useVideoToggle('video_likes', video.id)
  const favorite = useVideoToggle('favorites', video.id)
  const later = useVideoToggle('watch_later', video.id)
  const requireAuth = useRequireAuth()
  const [saveOpen, setSaveOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={`btn ${like.active ? 'btn-active' : 'btn-secondary'}`} aria-pressed={like.active} onClick={() => like.toggle(video)} title="VUEBOX 좋아요 (YouTube 좋아요와 별개)">
        <ThumbsUp className="size-4" aria-hidden fill={like.active ? 'currentColor' : 'none'} /> {like.active ? 'Liked' : 'Like'}
      </button>
      <button type="button" className={`btn ${favorite.active ? 'btn-active' : 'btn-secondary'}`} aria-pressed={favorite.active} onClick={() => favorite.toggle(video)}>
        <Star className="size-4" aria-hidden fill={favorite.active ? 'currentColor' : 'none'} /> {favorite.active ? 'Favorited' : 'Favorite'}
      </button>
      <button type="button" className={`btn ${later.active ? 'btn-active' : 'btn-secondary'}`} aria-pressed={later.active} onClick={() => later.toggle(video)}>
        <Clock className="size-4" aria-hidden /> {later.active ? 'Saved' : 'Watch Later'}
      </button>
      <button type="button" className="btn btn-secondary" onClick={requireAuth(() => setSaveOpen(true))}>
        <ListPlus className="size-4" aria-hidden /> Save
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => void share(video, getTime())}>
        <Share2 className="size-4" aria-hidden /> Share
      </button>
      {saveOpen && <SaveToPlaylistModal video={video} open onClose={() => setSaveOpen(false)} />}
    </div>
  )
}
