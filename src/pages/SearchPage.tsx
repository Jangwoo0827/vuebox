import { Loader2, SearchX } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChannelCard, YtPlaylistCard } from '@/components/video/ChannelCard'
import { VideoRow } from '@/components/video/VideoRow'
import { SearchSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/StateViews'
import { signalFromQuery } from '@/features/recommendations/profile'
import { signalQueue } from '@/features/recommendations/signalQueue'
import { useInfiniteList } from '@/hooks/useInfiniteList'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSearchHistory } from '@/hooks/useSearchHistory'
import { useSettings } from '@/hooks/useSettings'
import { qk } from '@/lib/queryKeys'
import { searchChannels, searchPlaylists, searchVideos } from '@/services/youtubeService'
import type { Channel, Page, PlaylistSummary, SearchDuration, SearchOrder, SearchType, Video } from '@/types/youtube'

const TYPES: { value: SearchType; label: string }[] = [
  { value: 'video', label: 'Videos' },
  { value: 'channel', label: 'Channels' },
  { value: 'playlist', label: 'Playlists' },
]

// Only filters the YouTube search.list API really supports are offered.
const ORDERS: { value: SearchOrder; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Latest' },
  { value: 'viewCount', label: 'Most Viewed' },
]
const DURATIONS: { value: SearchDuration; label: string }[] = [
  { value: 'short', label: 'Short (<4m)' },
  { value: 'medium', label: 'Medium (4–20m)' },
  { value: 'long', label: 'Long (>20m)' },
]

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').trim().slice(0, 100)
  const type = (['video', 'channel', 'playlist'] as const).find((t) => t === params.get('type')) ?? 'video'
  const order = (['relevance', 'date', 'viewCount'] as const).find((t) => t === params.get('order'))
  const duration = (['short', 'medium', 'long'] as const).find((t) => t === params.get('duration'))
  const hd = params.get('hd') === '1'
  const live = params.get('live') === '1'
  const { settings } = useSettings()
  const { record } = useSearchHistory()

  usePageTitle(q ? `${q} 검색 결과` : '검색')

  // The URL is the source of truth, so searches are shareable and back-button friendly.
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null || next.get(key) === value) next.delete(key)
    else next.set(key, value)
    if (key === 'type') ['order', 'duration', 'hd', 'live'].forEach((k) => next.delete(k))
    setParams(next, { replace: true })
  }

  // Record the search once per query (history + interest signal).
  useEffect(() => {
    if (!q) return
    void record(q)
    signalQueue.addSignal(signalFromQuery(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const region = settings.region
  const list = useInfiniteList<Page<Video> | Page<Channel> | Page<PlaylistSummary>>(
    qk.search(type, { q, order, duration, hd, live, region }),
    (pageToken) => {
      if (type === 'channel') return searchChannels({ q, pageToken, regionCode: region })
      if (type === 'playlist') return searchPlaylists({ q, pageToken, regionCode: region })
      return searchVideos({ q, pageToken, regionCode: region, order, videoDuration: duration, videoDefinition: hd ? 'high' : undefined, eventType: live ? 'live' : undefined })
    },
    q.length > 0, // an empty query never calls the API
  )

  if (!q) return <EmptyState icon={<SearchX className="size-6" />} title="검색어를 입력하세요" description="영상, 채널, 재생목록을 검색할 수 있습니다." />

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="검색 유형">
        {TYPES.map((t) => (
          <button key={t.value} type="button" aria-pressed={type === t.value} className="chip" onClick={() => set('type', t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {type === 'video' && (
        <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="검색 필터">
          {ORDERS.map((o) => (
            <button key={o.value} type="button" className="chip" aria-pressed={(order ?? 'relevance') === o.value} onClick={() => set('order', o.value === 'relevance' ? null : o.value)}>
              {o.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          {DURATIONS.map((d) => (
            <button key={d.value} type="button" className="chip" aria-pressed={duration === d.value} onClick={() => set('duration', d.value)}>
              {d.label}
            </button>
          ))}
          <button type="button" className="chip" aria-pressed={hd} onClick={() => set('hd', hd ? null : '1')}>
            HD
          </button>
          <button type="button" className="chip" aria-pressed={live} onClick={() => set('live', live ? null : '1')}>
            Live
          </button>
        </div>
      )}

      {list.isPending && <SearchSkeleton />}
      {list.isError && <ErrorState error={list.error} onRetry={() => void list.refetch()} />}
      {!list.isPending && !list.isError && list.items.length === 0 && (
        <EmptyState icon={<SearchX className="size-6" />} title={`"${q}"에 대한 결과가 없습니다`} description="다른 검색어나 필터를 사용해보세요." />
      )}

      {list.items.length > 0 && (
        <div className={type === 'playlist' ? 'grid grid-cols-1 gap-6 min-[560px]:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-3'}>
          {type === 'video' && (list.items as Video[]).map((v) => <VideoRow key={v.id} video={v} showDescription />)}
          {type === 'channel' && (list.items as Channel[]).map((c) => <ChannelCard key={c.id} channel={c} />)}
          {type === 'playlist' && (list.items as PlaylistSummary[]).map((p) => <YtPlaylistCard key={p.id} playlist={p} />)}
        </div>
      )}

      <div ref={list.sentinel} className="flex h-16 items-center justify-center">
        {list.isFetchingNextPage && <Loader2 className="size-5 animate-spin text-text-secondary" aria-label="더 불러오는 중" />}
      </div>
      {list.isFetchNextPageError && <ErrorState compact error={list.error} onRetry={() => void list.fetchNextPage()} />}
    </div>
  )
}
