import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, ErrorState } from '@/components/ui/StateViews'
import { Skeleton, VideoGridSkeleton } from '@/components/ui/Skeleton'
import { SubscribeButton, YtPlaylistCard } from '@/components/video/ChannelCard'
import { InfiniteVideoGrid } from '@/components/video/InfiniteVideoGrid'
import { VideoGrid } from '@/components/video/VideoGrid'
import { isShortVideo, SHORT_MAX_SECONDS } from '@/constants/video'
import { useClientPaged } from '@/hooks/useClientPaged'
import { useInfiniteList } from '@/hooks/useInfiniteList'
import { usePageTitle } from '@/hooks/usePageTitle'
import { AppError } from '@/lib/errors'
import { qk } from '@/lib/queryKeys'
import { getChannelDetails, getChannelPlaylists, getChannelUploadsAll, getChannelVideos } from '@/services/youtubeService'
import type { Video } from '@/types/youtube'
import { formatCount } from '@/utils/format'

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/
type Tab = 'videos' | 'shorts' | 'playlists'
type Sort = 'latest' | 'popular' | 'oldest'

const TABS: { id: Tab; label: string }[] = [
  { id: 'videos', label: 'Videos' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'playlists', label: 'Playlists' },
]
const SORTS: { id: Sort; label: string }[] = [
  { id: 'popular', label: '인기순' },
  { id: 'latest', label: '최신순' },
  { id: 'oldest', label: '예전순' },
]

function sortVideos(videos: readonly Video[], sort: Sort): Video[] {
  const list = [...videos]
  if (sort === 'popular') return list.sort((a, b) => (b.viewCount ?? -1) - (a.viewCount ?? -1))
  if (sort === 'oldest') return list.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
  return list.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

export default function ChannelPage() {
  const { id = '' } = useParams()
  if (!CHANNEL_ID.test(id)) return <ErrorState error={new AppError('NOT_FOUND', 'invalid channel id')} />
  return <ChannelView channelId={id} />
}

/** Popular / oldest need the whole upload list (the API only lists newest-first), so they load it once and sort here. */
function SortedUploads({ channelId, tab, sort }: { channelId: string; tab: Tab; sort: Sort }) {
  const all = useQuery({ queryKey: qk.channelUploadsAll(channelId), queryFn: () => getChannelUploadsAll(channelId), staleTime: 30 * 60_000, retry: false })
  const sorted = useMemo(() => sortVideos((all.data?.items ?? []).filter((v) => (tab === 'shorts' ? isShortVideo(v) : true)), sort), [all.data, tab, sort])
  const paged = useClientPaged(sorted, `${tab}-${sort}`)

  if (all.isPending) {
    return (
      <div>
        <p className="mb-4 flex items-center gap-2 text-sm text-text-secondary" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> 채널의 모든 영상을 불러와 정렬하는 중입니다. 영상이 많으면 몇 초 걸립니다.
        </p>
        <VideoGridSkeleton count={4} />
      </div>
    )
  }
  if (all.isError) return <ErrorState error={all.error} onRetry={() => void all.refetch()} />
  return (
    <>
      {all.data.truncated && <p className="mb-4 text-sm text-text-secondary">영상이 매우 많은 채널이라 가장 최근 2,000개 안에서 정렬했습니다.</p>}
      {sorted.length === 0 ? (
        <EmptyState title={tab === 'shorts' ? `${SHORT_MAX_SECONDS / 60}분 이하 영상이 없습니다` : '공개된 영상이 없습니다'} />
      ) : (
        <>
          <VideoGrid videos={paged.visible} />
          <div ref={paged.sentinel} className="h-12" />
        </>
      )}
    </>
  )
}

function ChannelView({ channelId }: { channelId: string }) {
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'videos'
  const sort: Sort = SORTS.find((s) => s.id === params.get('sort'))?.id ?? 'latest'
  const sortedMode = sort !== 'latest' && tab !== 'playlists'

  const channelQ = useQuery({
    queryKey: qk.channel(channelId),
    queryFn: async () => {
      const [c] = await getChannelDetails([channelId])
      if (!c) throw new AppError('NOT_FOUND', 'channel not found')
      return c
    },
    staleTime: 60 * 60_000,
  })
  const channel = channelQ.data
  usePageTitle(channel?.title, channel?.description.slice(0, 160))

  // "Latest" streams page by page from the uploads playlist (~2 quota units per page, never search.list).
  const uploads = useInfiniteList(qk.channelUploadsPaged(channelId), (pageToken) => getChannelVideos({ channelId, pageToken, maxResults: 30 }), tab !== 'playlists' && !sortedMode)
  const playlists = useInfiniteList(qk.channelPlaylists(channelId), (pageToken) => getChannelPlaylists({ channelId, pageToken }), tab === 'playlists')

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  if (channelQ.isPending) {
    return (
      <div aria-busy>
        <Skeleton className="mb-4 h-32 w-full !rounded-lg sm:h-48" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }
  if (channelQ.isError || !channel) return <ErrorState error={channelQ.error} onRetry={() => void channelQ.refetch()} />

  return (
    <div>
      {channel.banner && <img src={`${channel.banner}=w1707`} alt="" className="mb-4 aspect-[6/1] max-h-48 w-full rounded-lg object-cover" referrerPolicy="no-referrer" />}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar src={channel.avatar} name={channel.title} size={96} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">{channel.title}</h1>
          <p className="text-sm text-text-secondary">
            {[channel.customUrl, channel.subscriberCount !== null ? `구독자 ${formatCount(channel.subscriberCount)}명` : null, channel.videoCount !== null ? `동영상 ${formatCount(channel.videoCount)}개` : null].filter(Boolean).join(' · ')}
          </p>
          {channel.description && <p className="mt-2 line-clamp-2 max-w-3xl whitespace-pre-wrap text-sm text-text-secondary">{channel.description}</p>}
        </div>
        <SubscribeButton channel={channel} />
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div role="group" aria-label="채널 탭" className="flex gap-2">
          {TABS.map((t) => (
            <button key={t.id} type="button" className="chip" aria-pressed={tab === t.id} onClick={() => setParam('tab', t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'playlists' && (
          <div role="group" aria-label="정렬" className="flex gap-2">
            {SORTS.map((s) => (
              <button key={s.id} type="button" className="chip" aria-pressed={sort === s.id} onClick={() => setParam('sort', s.id === 'latest' ? null : s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'shorts' && <p className="mb-4 text-sm text-text-secondary">YouTube API는 쇼츠 여부를 알려주지 않아, 길이가 {SHORT_MAX_SECONDS / 60}분 이하인 업로드를 표시합니다.</p>}

      {sortedMode && <SortedUploads channelId={channelId} tab={tab} sort={sort} />}
      {!sortedMode && tab === 'videos' && <InfiniteVideoGrid list={uploads} emptyTitle="공개된 영상이 없습니다" />}
      {!sortedMode && tab === 'shorts' && <InfiniteVideoGrid list={uploads} filter={isShortVideo} emptyTitle={`${SHORT_MAX_SECONDS / 60}분 이하 영상이 없습니다`} />}
      {tab === 'playlists' && (
        <>
          {playlists.isPending && <Loader2 className="mx-auto size-6 animate-spin text-text-secondary" aria-label="불러오는 중" />}
          {playlists.isError && <ErrorState error={playlists.error} onRetry={() => void playlists.refetch()} />}
          {!playlists.isPending && !playlists.isError && playlists.items.length === 0 && <EmptyState title="공개 재생목록이 없습니다" />}
          <div className="grid grid-cols-1 gap-6 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {playlists.items.map((p) => (
              <YtPlaylistCard key={p.id} playlist={p} />
            ))}
          </div>
          <div ref={playlists.sentinel} className="h-12" />
        </>
      )}
    </div>
  )
}
