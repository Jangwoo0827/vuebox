import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ContinueWatchingCard } from '@/components/video/ContinueWatchingCard'
import { VideoGrid, VideoShelf } from '@/components/video/VideoGrid'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Section } from '@/components/ui/Section'
import { VideoGridSkeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/StateViews'
import { useHomeFeeds, type Section as FeedSection } from '@/features/home/useHomeFeeds'
import { useAuth } from '@/hooks/useAuth'
import { useChannelAvatars } from '@/hooks/useChannelAvatars'
import { useVideos } from '@/hooks/useLibrary'
import { usePageTitle } from '@/hooks/usePageTitle'
import { qk } from '@/lib/queryKeys'
import { listContinueWatching } from '@/services/historyService'

function ContinueWatching() {
  const { userId } = useAuth()
  const q = useQuery({ queryKey: qk.continueWatching(userId ?? 'anon'), queryFn: () => listContinueWatching(userId!, 12), enabled: !!userId, staleTime: 60_000 })
  const entries = q.data ?? []
  const fresh = useVideos(entries.map((e) => e.video_id), entries.length > 0)
  const avatars = useChannelAvatars(fresh.data ?? [])
  if (!userId || q.isError || entries.length === 0) return null // quietly absent: nothing to resume
  const byId = new Map((fresh.data ?? []).map((v) => [v.id, v]))
  return (
    <Section title="Continue Watching" subtitle="이어서 시청하세요" action={{ label: '시청 기록', to: '/history' }}>
      <div className="scroll-x -mx-1 px-1">
        {entries.map((e) => (
          <ContinueWatchingCard key={e.id} entry={e} video={byId.get(e.video_id)} avatar={avatars.get(byId.get(e.video_id)?.channelId ?? e.channel_id_snapshot ?? '')} />
        ))}
      </div>
    </Section>
  )
}

interface FeedSectionProps {
  title: string
  subtitle?: string
  section: FeedSection
  shelf?: boolean
  action?: { label: string; to: string }
  empty?: ReactNode
}

function FeedSectionView({ title, subtitle, section, shelf, action, empty }: FeedSectionProps) {
  if (section.loading) {
    return (
      <Section title={title} subtitle={subtitle}>
        <VideoGridSkeleton count={4} />
      </Section>
    )
  }
  if (section.error && section.videos.length === 0) {
    return (
      <Section title={title}>
        <ErrorState error={section.error} compact title="이 섹션을 불러오지 못했습니다" />
      </Section>
    )
  }
  if (section.videos.length === 0) return empty ? <Section title={title}>{empty}</Section> : null
  return (
    <Section title={title} subtitle={subtitle} action={action}>
      <ErrorBoundary>{shelf ? <VideoShelf videos={section.videos} /> : <VideoGrid videos={section.videos} />}</ErrorBoundary>
    </Section>
  )
}

export default function HomePage() {
  usePageTitle(null)
  const { isSignedIn } = useAuth()
  const feeds = useHomeFeeds()

  return (
    <div>
      {isSignedIn && <ContinueWatching />}

      {isSignedIn && feeds.personalized ? (
        <>
          <FeedSectionView
            title="For You"
            subtitle="시청 기록, 검색, 좋아요를 바탕으로 한 추천"
            section={feeds.forYou}
            empty={<p className="text-sm text-text-secondary">영상을 몇 개 시청하거나 검색하면 이곳에 맞춤 추천이 표시됩니다.</p>}
          />
          <FeedSectionView title={feeds.becauseTitle ? `Because You Watched "${feeds.becauseTitle}"` : 'Because You Watched…'} section={feeds.because} shelf />
          <FeedSectionView title="Based on Your Searches" subtitle={feeds.searchQuery ? `"${feeds.searchQuery}" 관련` : undefined} section={feeds.basedOnSearch} shelf />
          <FeedSectionView title="From Your Subscriptions" section={feeds.fromSubscriptions} shelf action={{ label: '전체 보기', to: '/subscriptions' }} />
        </>
      ) : (
        isSignedIn && (
          <p className="mb-8 rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
            개인화가 꺼져 있어 일반 인기 영상을 보여드립니다.{' '}
            <Link to="/settings" className="text-accent underline">
              설정
            </Link>
            에서 다시 켤 수 있습니다.
          </p>
        )
      )}

      <FeedSectionView title="Trending" subtitle={`${feeds.region} 지역 인기 급상승`} section={feeds.trending} action={{ label: '더 보기', to: '/trending' }} />
      <FeedSectionView title="Popular" subtitle="가장 많이 본 영상" section={feeds.popular} shelf />
      {!isSignedIn && <FeedSectionView title="Latest" subtitle="방금 올라온 인기 영상" section={feeds.latest} shelf />}
      <FeedSectionView title="Discover Something New" subtitle={`오늘의 카테고리: ${feeds.discoverLabel}`} section={feeds.discover} shelf action={{ label: 'Discover', to: '/discover' }} />

      {!isSignedIn && (
        <aside className="card mt-2 flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">로그인하고 나만의 VUEBOX를 만들어보세요</h2>
            <p className="text-sm text-text-secondary">시청 기록 이어보기, 재생목록, 맞춤 추천이 모든 기기에서 동기화됩니다.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/signup" className="btn btn-primary">
              회원가입
            </Link>
            <Link to="/login" className="btn btn-secondary">
              로그인
            </Link>
          </div>
        </aside>
      )}
    </div>
  )
}
