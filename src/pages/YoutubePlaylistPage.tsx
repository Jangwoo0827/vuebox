import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/Section'
import { ErrorState } from '@/components/ui/StateViews'
import { InfiniteVideoGrid } from '@/components/video/InfiniteVideoGrid'
import { useInfiniteList } from '@/hooks/useInfiniteList'
import { usePageTitle } from '@/hooks/usePageTitle'
import { AppError } from '@/lib/errors'
import { qk } from '@/lib/queryKeys'
import { getPlaylistVideos } from '@/services/youtubeService'

/** A public YouTube playlist (from search or a channel's Playlists tab). Not to be confused with your own playlists. */
export default function YoutubePlaylistPage() {
  const { id = '' } = useParams()
  const valid = /^[A-Za-z0-9_-]{10,64}$/.test(id)
  const list = useInfiniteList(qk.ytPlaylist(id), (pageToken) => getPlaylistVideos({ playlistId: id, pageToken }), valid)
  const meta = list.data?.pages[0]?.playlist
  usePageTitle(meta?.title ?? '재생목록')

  if (!valid) return <ErrorState error={new AppError('NOT_FOUND', 'invalid playlist id')} />
  const first = list.items[0]

  return (
    <div>
      <PageHeader
        title={meta?.title ?? '재생목록'}
        description={meta ? `${meta.channelTitle}${meta.itemCount !== null ? ` · 동영상 ${meta.itemCount}개` : ''}` : undefined}
        actions={
          first && (
            <Link to={`/watch/${first.id}`} className="btn btn-primary">
              첫 영상부터 재생
            </Link>
          )
        }
      />
      <InfiniteVideoGrid list={list} emptyTitle="재생목록에 영상이 없습니다" />
    </div>
  )
}
