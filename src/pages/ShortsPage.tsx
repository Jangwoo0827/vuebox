import { ChevronDown, ChevronUp, Clock, Share2, ThumbsUp } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StateViews'
import { PlayerContainer } from '@/features/player/PlayerContainer'
import type { PlayerApi } from '@/features/player/useYouTubePlayer'
import { useWatchTracking } from '@/features/player/useWatchTracking'
import { useAuth } from '@/hooks/useAuth'
import { useInfiniteList } from '@/hooks/useInfiniteList'
import { useVideoToggle } from '@/hooks/useLibrary'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSettings } from '@/hooks/useSettings'
import { qk } from '@/lib/queryKeys'
import { searchVideos } from '@/services/youtubeService'
import { toast } from '@/stores/toastStore'
import type { Video } from '@/types/youtube'

const SHORT_MAX_SECONDS = 60

function ShortPlayer({ video }: { video: Video }) {
  const { userId } = useAuth()
  const { settings } = useSettings()
  const apiRef = useRef<PlayerApi | null>(null)
  const tracking = useWatchTracking({ video, apiRef, userId, saveHistory: settings.save_watch_history, existing: null, ready: true })
  return (
    <PlayerContainer
      videoId={video.id}
      startSeconds={0}
      autoplay
      playbackRate={1}
      enabled
      theater={false}
      onToggleTheater={() => undefined}
      apiRef={apiRef}
      onStateChange={tracking.onStateChange}
      vertical
      hideControls
    />
  )
}

export default function ShortsPage() {
  usePageTitle('Shorts', '짧은 영상을 연속으로 보세요')
  const { settings } = useSettings()
  const region = settings.region
  // No official "is a Short" flag exists in the API, so this page shows short (<4 min) search results that are ≤ 60 s.
  const list = useInfiniteList(qk.search('shorts', region), (pageToken) => searchVideos({ q: '#shorts', videoDuration: 'short', regionCode: region, pageToken }))
  const shorts = list.items.filter((v: Video) => v.durationSeconds > 0 && v.durationSeconds <= SHORT_MAX_SECONDS)
  const [index, setIndex] = useState(0)
  const current = shorts[Math.min(index, Math.max(0, shorts.length - 1))]

  const like = useVideoToggle('video_likes', current?.id ?? '')
  const later = useVideoToggle('watch_later', current?.id ?? '')

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list
  // Prefetch the next page when the user gets near the end (and when a page had no Shorts at all).
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && index >= shorts.length - 3) void fetchNextPage()
  }, [index, shorts.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  const go = useCallback((delta: number) => setIndex((i) => Math.max(0, Math.min(Math.max(0, shorts.length - 1), i + delta))), [shorts.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        go(-1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go])

  if (list.isPending) return <LoadingState label="Shorts를 불러오는 중…" />
  if (list.isError && shorts.length === 0) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />
  if (!current) return list.hasNextPage ? <LoadingState /> : <EmptyState title="표시할 쇼츠가 없습니다" description="잠시 후 다시 시도해 주세요." />

  const share = async () => {
    const url = `${window.location.origin}/watch/${current.id}`
    try {
      if (navigator.share) await navigator.share({ title: current.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('링크를 복사했습니다.')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error('링크를 공유하지 못했습니다.')
    }
  }

  const side = 'flex size-12 items-center justify-center rounded-full bg-surface-2 hover:bg-surface-hover disabled:opacity-40'

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
      <p className="text-center text-xs text-text-secondary">길이 {SHORT_MAX_SECONDS}초 이하의 영상 · 방향키 ↑↓ 또는 버튼으로 이동</p>
      <div className="flex w-full items-end justify-center gap-3">
        <div className="min-w-0 max-w-[min(100%,calc((100dvh-var(--topbar-h)-var(--bottomnav-h)-140px)*9/16))] flex-1">
          <ShortPlayer key={current.id} video={current} />
        </div>
        <div className="flex shrink-0 flex-col gap-3" role="group" aria-label="쇼츠 동작">
          <button type="button" className={side} aria-label="이전 영상" disabled={index === 0} onClick={() => go(-1)}>
            <ChevronUp className="size-6" aria-hidden />
          </button>
          <button type="button" className={`${side} ${like.active ? '!bg-accent-soft text-accent' : ''}`} aria-label="좋아요" aria-pressed={like.active} onClick={() => like.toggle(current)}>
            <ThumbsUp className="size-5" aria-hidden fill={like.active ? 'currentColor' : 'none'} />
          </button>
          <button type="button" className={`${side} ${later.active ? '!bg-accent-soft text-accent' : ''}`} aria-label="나중에 보기에 저장" aria-pressed={later.active} onClick={() => later.toggle(current)}>
            <Clock className="size-5" aria-hidden />
          </button>
          <button type="button" className={side} aria-label="공유" onClick={() => void share()}>
            <Share2 className="size-5" aria-hidden />
          </button>
          <button type="button" className={side} aria-label="다음 영상" disabled={index >= shorts.length - 1 && !list.hasNextPage} onClick={() => go(1)}>
            <ChevronDown className="size-6" aria-hidden />
          </button>
        </div>
      </div>
      <div className="w-full">
        <h1 className="line-clamp-2 font-semibold">{current.title}</h1>
        <Link to={`/channel/${current.channelId}`} className="text-sm text-text-secondary hover:underline">
          {current.channelTitle}
        </Link>
      </div>
    </div>
  )
}
