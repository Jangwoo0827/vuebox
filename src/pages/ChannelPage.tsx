import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, ErrorState } from '@/components/ui/StateViews'
import { Skeleton } from '@/components/ui/Skeleton'
import { SubscribeButton, YtPlaylistCard } from '@/components/video/ChannelCard'
import { InfiniteVideoGrid } from '@/components/video/InfiniteVideoGrid'
import { useInfiniteList } from '@/hooks/useInfiniteList'
import { usePageTitle } from '@/hooks/usePageTitle'
import { AppError } from '@/lib/errors'
import { qk } from '@/lib/queryKeys'
import { getChannelDetails, getChannelPlaylists, getChannelVideos } from '@/services/youtubeService'
import { formatCount } from '@/utils/format'

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/
type Tab = 'videos' | 'shorts' | 'playlists'
const TABS: { id: Tab; label: string }[] = [
  { id: 'videos', label: 'Videos' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'playlists', label: 'Playlists' },
]

export default function ChannelPage() {
  const { id = '' } = useParams()
  if (!CHANNEL_ID.test(id)) return <ErrorState error={new AppError('NOT_FOUND', 'invalid channel id')} />
  return <ChannelView channelId={id} />
}

function ChannelView({ channelId }: { channelId: string }) {
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'videos'

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

  // Videos and Shorts share one uploads query (playlistItems, ~2 quota units per page, never search.list).
  const uploads = useInfiniteList(qk.channelUploadsPaged(channelId), (pageToken) => getChannelVideos({ channelId, pageToken, maxResults: 30 }), tab !== 'playlists')
  const playlists = useInfiniteList(qk.channelPlaylists(channelId), (pageToken) => getChannelPlaylists({ channelId, pageToken }), tab === 'playlists')

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

      <div role="group" aria-label="채널 탭" className="mb-6 flex gap-2 border-b border-border pb-3">
        {TABS.map((t) => (
          <button key={t.id} type="button" className="chip" aria-pressed={tab === t.id} onClick={() => setParams({ tab: t.id }, { replace: true })}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'videos' && <InfiniteVideoGrid list={uploads} emptyTitle="공개된 영상이 없습니다" />}
      {tab === 'shorts' && (
        <>
          <p className="mb-4 text-sm text-text-secondary">YouTube API는 쇼츠 여부를 알려주지 않아, 길이가 60초 이하인 업로드를 표시합니다.</p>
          <InfiniteVideoGrid list={uploads} filter={(v) => v.durationSeconds > 0 && v.durationSeconds <= 60} emptyTitle="60초 이하 영상이 없습니다" />
        </>
      )}
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
