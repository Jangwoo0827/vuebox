import { useChannelAvatars } from '@/hooks/useChannelAvatars'
import type { Video } from '@/types/youtube'
import { VideoCard } from './VideoCard'

export const GRID_CLASS = 'grid grid-cols-1 gap-x-4 gap-y-7 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'

interface Props {
  videos: readonly Video[]
  progress?: ReadonlyMap<string, number>
  playlistId?: string
}

export function VideoGrid({ videos, progress, playlistId }: Props) {
  const avatars = useChannelAvatars(videos)
  return (
    <div className={GRID_CLASS}>
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} avatar={avatars.get(v.channelId)} progress={progress?.get(v.id)} playlistId={playlistId} />
      ))}
    </div>
  )
}

/** Horizontally scrolling shelf used on Home for compact sections. */
export function VideoShelf({ videos }: { videos: readonly Video[] }) {
  const avatars = useChannelAvatars(videos)
  return (
    <div className="scroll-x -mx-1 px-1">
      {videos.map((v) => (
        <div key={v.id} className="w-[72vw] shrink-0 sm:w-72">
          <VideoCard video={v} avatar={avatars.get(v.channelId)} />
        </div>
      ))}
    </div>
  )
}
