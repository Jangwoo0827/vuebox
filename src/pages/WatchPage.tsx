import { useQuery } from '@tanstack/react-query'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { PlayerSkeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/StateViews'
import { SubscribeButton } from '@/components/video/ChannelCard'
import { VideoActions } from '@/components/video/VideoActions'
import { VideoRow } from '@/components/video/VideoRow'
import { NotesPanel } from '@/features/notes/NotesPanel'
import { PlayerContainer } from '@/features/player/PlayerContainer'
import type { PlayerApi } from '@/features/player/useYouTubePlayer'
import { usePlayerShortcuts } from '@/features/player/usePlayerShortcuts'
import { useWatchTracking } from '@/features/player/useWatchTracking'
import { PlayerState } from '@/features/player/youtubeApi'
import { useRelatedVideos } from '@/features/recommendations/useRelatedVideos'
import { useAuth } from '@/hooks/useAuth'
import { useImmersiveLandscape } from '@/hooks/useImmersiveLandscape'
import { useVideos } from '@/hooks/useLibrary'
import { usePageTitle } from '@/hooks/usePageTitle'
import { usePlaylistItems } from '@/hooks/usePlaylists'
import { useSettings } from '@/hooks/useSettings'
import { AppError } from '@/lib/errors'
import { qk } from '@/lib/queryKeys'
import { getHistoryEntry } from '@/services/historyService'
import { getChannelDetails, getVideoDetails } from '@/services/youtubeService'
import { toast } from '@/stores/toastStore'
import { useUiStore } from '@/stores/uiStore'
import type { Video } from '@/types/youtube'
import { formatCount, formatDate, formatDuration, formatViews } from '@/utils/format'

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const URL_RE = /(https?:\/\/[^\s<>"']+)/g

/** Plain-text description with safe, clickable https links (no HTML is ever injected). */
function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const parts = useMemo(() => text.split(URL_RE), [text])
  return (
    <div className="rounded-lg bg-surface p-4 text-sm">
      <div className={`whitespace-pre-wrap break-words ${open ? '' : 'line-clamp-3'}`}>
        {parts.map((p, i) =>
          i % 2 === 1 ? (
            <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline">
              {p}
            </a>
          ) : (
            <Fragment key={i}>{p}</Fragment>
          ),
        )}
      </div>
      {text.length > 160 && (
        <button type="button" className="mt-2 font-semibold text-accent" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? '간단히 보기' : '더 보기'}
        </button>
      )}
    </div>
  )
}

export default function WatchPage() {
  const { id = '' } = useParams()
  if (!VIDEO_ID.test(id)) return <ErrorState error={new AppError('NOT_FOUND', 'invalid id')} />
  // Keyed by video: every video gets a fresh player, tracking session and resume position.
  return <WatchView key={id} videoId={id} />
}

function WatchView({ videoId }: { videoId: string }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const { settings } = useSettings()
  const theater = useUiStore((s) => s.theater)
  const toggleTheater = useUiStore((s) => s.toggleTheater)
  const apiRef = useRef<PlayerApi | null>(null)
  const immersive = useImmersiveLandscape()
  const listId = params.get('list') ?? undefined

  const videoQ = useQuery({
    queryKey: qk.video(videoId),
    queryFn: async () => {
      const [v] = await getVideoDetails([videoId], true)
      if (!v) throw new AppError('NOT_FOUND', 'video unavailable')
      return v
    },
    staleTime: 10 * 60_000,
  })
  const video = videoQ.data
  usePageTitle(video?.title, video?.description.slice(0, 160))

  const channelQ = useQuery({ queryKey: qk.channel(video?.channelId ?? 'none'), queryFn: async () => (await getChannelDetails([video!.channelId]))[0] ?? null, enabled: !!video?.channelId, staleTime: 60 * 60_000 })

  // Resume position comes from Supabase, so it follows the account across devices.
  const historyQ = useQuery({ queryKey: qk.historyEntry(userId ?? 'anon', videoId), queryFn: () => getHistoryEntry(userId!, videoId), enabled: !!userId, staleTime: 0, gcTime: 0 })
  const resumeReady = !userId || historyQ.isFetched
  const history = historyQ.data

  const startSeconds = useMemo(() => {
    const t = Number(params.get('t'))
    if (Number.isFinite(t) && t > 0) return Math.floor(t)
    // Nearly finished or completed videos restart from the beginning.
    if (history && !history.completed && history.watch_percentage < 95 && history.progress_seconds > 5) return Math.max(0, history.progress_seconds - 2)
    return 0
  }, [params, history])

  const tracking = useWatchTracking({ video: video ?? null, apiRef, userId, saveHistory: settings.save_watch_history, existing: history, ready: !!video && resumeReady })
  usePlayerShortcuts(apiRef, toggleTheater)

  // --- queue / up next --------------------------------------------------------------------------------
  const playlistItems = usePlaylistItems(listId)
  const queueVideos = useVideos(playlistItems.data?.map((i) => i.video_id) ?? [], !!playlistItems.data?.length)
  const related = useRelatedVideos(video)
  const queueIds = playlistItems.data?.map((i) => i.video_id) ?? []
  const nextId = listId ? queueIds[queueIds.indexOf(videoId) + 1] : related.videos[0]?.id
  const [upNext, setUpNext] = useState<number | null>(null)

  const goNext = useCallback(() => nextId && navigate(`/watch/${nextId}${listId ? `?list=${listId}` : ''}`), [nextId, navigate, listId])

  useEffect(() => {
    if (upNext === null) return
    if (upNext <= 0) {
      goNext()
      return
    }
    const t = setTimeout(() => setUpNext(upNext - 1), 1000)
    return () => clearTimeout(t)
  }, [upNext, goNext])

  const onStateChange = useCallback(
    (state: number) => {
      tracking.onStateChange(state)
      if (state === PlayerState.ENDED && settings.autoplay && nextId) setUpNext(5)
      else if (state === PlayerState.PLAYING) setUpNext(null)
    },
    [tracking, settings.autoplay, nextId],
  )

  const onReady = useCallback(() => {
    if (startSeconds > 5 && !params.get('t')) {
      toast.withAction(`이전 시청 위치(${formatDuration(startSeconds)})부터 이어서 재생합니다.`, { label: '처음부터', run: () => apiRef.current?.seekTo(0) })
    }
  }, [startSeconds, params])

  if (videoQ.isPending) return <PlayerSkeleton />
  if (videoQ.isError || !video) return <ErrorState error={videoQ.error} onRetry={() => void videoQ.refetch()} />

  const channel = channelQ.data
  const queueRows = queueVideos.data ?? []

  return (
    <div className={`grid gap-x-6 gap-y-5 lg:grid-rows-[auto_1fr] ${immersive ? 'gap-y-0' : ''} ${theater ?'lg:grid-cols-[minmax(0,1fr)_380px]' : 'lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]'}`}>
      {/* Player: spans the full width in theater mode but is never re-mounted when toggling. */}
      <div className={immersive ? 'bg-black' : theater ? 'lg:col-span-2' : 'lg:col-start-1 lg:row-start-1'}>
        <div className={immersive ? 'mx-auto w-[min(100%,calc(100dvh*16/9))]' : theater ? 'mx-auto w-[min(100%,calc((100dvh-var(--topbar-h)-150px)*16/9))]' : ''}>
          {video.embeddable ? (
            <PlayerContainer
              videoId={video.id}
              startSeconds={startSeconds}
              autoplay={settings.autoplay}
              playbackRate={settings.default_playback_rate}
              enabled={resumeReady}
              theater={theater}
              onToggleTheater={toggleTheater}
              immersive={immersive}
              apiRef={apiRef}
              onStateChange={onStateChange}
              onReady={onReady}
            />
          ) : (
            <div className="player-box grid place-items-center p-6 text-center text-white">
              <div>
                <p className="mb-3 text-sm">영상 소유자가 외부 사이트에서의 재생을 허용하지 않았습니다.</p>
                <a className="btn btn-secondary" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">
                  YouTube에서 보기
                </a>
              </div>
            </div>
          )}
          {upNext !== null && nextId && (
            <div role="status" className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              <span>{upNext}초 후 다음 영상을 재생합니다.</span>
              <span className="flex gap-2">
                <button type="button" className="btn btn-primary !min-h-9" onClick={goNext}>
                  지금 재생
                </button>
                <button type="button" className="btn btn-ghost !min-h-9" onClick={() => setUpNext(null)}>
                  취소
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-2">
        <div>
          <h1 className="text-xl font-bold leading-snug">{video.title}</h1>
          <p className="mt-1 text-sm text-text-secondary">{[formatViews(video.viewCount), video.publishedAt ? formatDate(video.publishedAt) : ''].filter(Boolean).join(' · ')}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to={`/channel/${video.channelId}`} aria-label={`${video.channelTitle} 채널`}>
              <Avatar src={channel?.avatar} name={video.channelTitle} size={44} />
            </Link>
            <div className="min-w-0">
              <Link to={`/channel/${video.channelId}`} className="block truncate font-semibold hover:underline">
                {video.channelTitle}
              </Link>
              {channel?.subscriberCount != null && <p className="text-xs text-text-secondary">구독자 {formatCount(channel.subscriberCount)}명</p>}
            </div>
            <SubscribeButton channel={channel ?? { id: video.channelId, title: video.channelTitle, avatar: '' }} />
          </div>
          <VideoActions video={video} getTime={() => apiRef.current?.getCurrentTime() ?? 0} />
        </div>

        {video.description && <Description text={video.description} />}

        <NotesPanel videoId={video.id} getTime={() => apiRef.current?.getCurrentTime() ?? 0} onSeek={(s) => apiRef.current?.seekTo(s)} />
      </div>

      <aside className={`min-w-0 ${theater ? 'lg:col-start-2 lg:row-start-2' : 'lg:col-start-2 lg:row-span-2 lg:row-start-1'}`} aria-label={listId ? '재생목록' : '추천 영상'}>
        {listId && queueRows.length > 0 && (
          <section className="card mb-4 overflow-hidden">
            <h2 className="border-b border-border px-4 py-3 font-semibold">재생목록 ({queueRows.length})</h2>
            <ul className="max-h-96 overflow-y-auto p-1.5">
              {queueRows.map((v: Video) => (
                <li key={v.id}>
                  <VideoRow video={v} playlistId={listId} active={v.id === videoId} />
                </li>
              ))}
            </ul>
          </section>
        )}
        <h2 className="mb-3 font-semibold">추천 영상</h2>
        {related.isLoading && <PlayerSkeleton />}
        {related.error != null && related.videos.length === 0 && <ErrorState compact error={related.error} />}
        <div className="flex flex-col gap-2">
          {related.videos.map((v) => (
            <VideoRow key={v.id} video={v} />
          ))}
        </div>
      </aside>
    </div>
  )
}
