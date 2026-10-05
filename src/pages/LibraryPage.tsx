import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { PageHeader, Section } from '@/components/ui/Section'
import { ContinueWatchingCard } from '@/components/video/ContinueWatchingCard'
import { PlaylistCard } from '@/components/video/PlaylistCard'
import { VideoShelf } from '@/components/video/VideoGrid'
import { useAuth } from '@/hooks/useAuth'
import { useChannelAvatars } from '@/hooks/useChannelAvatars'
import { useVideoRefs, useVideos } from '@/hooks/useLibrary'
import { usePageTitle } from '@/hooks/usePageTitle'
import { usePlaylists } from '@/hooks/usePlaylists'
import { qk } from '@/lib/queryKeys'
import { listContinueWatching, listHistory } from '@/services/historyService'
import type { VideoListTable } from '@/services/libraryService'
import { EmptyState } from '@/components/ui/StateViews'
import { Link } from 'react-router-dom'

const SHELF_SIZE = 10

/** One shelf of saved videos; hidden when empty so the Library stays compact. */
function SavedShelf({ table, title, to }: { table: VideoListTable; title: string; to: string }) {
  const refs = useVideoRefs(table)
  const ids = (refs.data ?? []).slice(0, SHELF_SIZE).map((r) => r.video_id)
  const videos = useVideos(ids, ids.length > 0)
  if (ids.length === 0 || !videos.data?.length) return null
  return (
    <Section title={title} action={{ label: '전체 보기', to }}>
      <VideoShelf videos={videos.data} />
    </Section>
  )
}

export default function LibraryPage() {
  usePageTitle('Library', '내 라이브러리')
  const { userId } = useAuth()
  const cont = useQuery({ queryKey: qk.continueWatching(userId ?? 'anon'), queryFn: () => listContinueWatching(userId!, 10), enabled: !!userId, staleTime: 60_000 })
  const hist = useQuery({ queryKey: [...qk.history(userId ?? 'anon'), 'preview'], queryFn: () => listHistory(userId!, SHELF_SIZE), enabled: !!userId, staleTime: 60_000 })
  const playlists = usePlaylists()

  const contIds = (cont.data ?? []).map((e) => e.video_id)
  const histIds = (hist.data ?? []).map((e) => e.video_id)
  const freshCont = useVideos(contIds, contIds.length > 0)
  const freshHist = useVideos(histIds, histIds.length > 0)
  const avatars = useChannelAvatars(freshCont.data ?? [])
  const contById = useMemo(() => new Map((freshCont.data ?? []).map((v) => [v.id, v])), [freshCont.data])

  const empty = cont.isSuccess && !cont.data?.length && hist.isSuccess && !hist.data?.length && playlists.isSuccess && !playlists.data?.length

  return (
    <div>
      <PageHeader title="Library" description="내 시청 기록, 저장한 영상, 재생목록" />

      {empty && (
        <EmptyState title="라이브러리가 비어 있습니다" description="영상을 시청하고 저장하면 이곳에 모입니다." action={<Link to="/" className="btn btn-primary">영상 둘러보기</Link>} />
      )}

      {!!cont.data?.length && (
        <Section title="Continue Watching" action={{ label: '시청 기록', to: '/history' }}>
          <div className="scroll-x -mx-1 px-1">
            {cont.data.map((e) => (
              <ContinueWatchingCard key={e.id} entry={e} video={contById.get(e.video_id)} avatar={avatars.get(contById.get(e.video_id)?.channelId ?? '')} />
            ))}
          </div>
        </Section>
      )}

      {!!freshHist.data?.length && (
        <Section title="History" action={{ label: '전체 보기', to: '/history' }}>
          <VideoShelf videos={freshHist.data} />
        </Section>
      )}

      <SavedShelf table="watch_later" title="Watch Later" to="/watch-later" />
      <SavedShelf table="favorites" title="Favorites" to="/favorites" />
      <SavedShelf table="video_likes" title="Liked" to="/liked" />

      {!!playlists.data?.length && (
        <Section title="Playlists" action={{ label: '전체 보기', to: '/playlists' }}>
          <div className="grid grid-cols-1 gap-6 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {playlists.data.slice(0, 8).map((p) => (
              <PlaylistCard key={p.id} playlist={p} />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
