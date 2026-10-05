import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { PageHeader } from '@/components/ui/Section'
import { VideoGridSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/StateViews'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useAuth } from '@/hooks/useAuth'
import { useSubscriptions, useSubscriptionToggle } from '@/hooks/useLibrary'
import { usePageTitle } from '@/hooks/usePageTitle'
import { qk } from '@/lib/queryKeys'
import { getSubscriptionFeed } from '@/services/youtubeService'
import type { SubscriptionRow } from '@/types/db'

const FEED_CHANNELS = 20

function ManageRow({ sub }: { sub: SubscriptionRow }) {
  const { toggle } = useSubscriptionToggle({ id: sub.youtube_channel_id, title: sub.channel_name, avatar: sub.avatar_url ?? '' })
  return (
    <li className="flex items-center gap-3 py-2">
      <Avatar src={sub.avatar_url} name={sub.channel_name} size={36} />
      <Link to={`/channel/${sub.youtube_channel_id}`} className="min-w-0 flex-1 truncate hover:underline">
        {sub.channel_name}
      </Link>
      <button type="button" className="btn btn-secondary !min-h-9" onClick={toggle} aria-label={`${sub.channel_name} 구독 취소`}>
        Unsubscribe
      </button>
    </li>
  )
}

export default function SubscriptionsPage() {
  usePageTitle('Subscriptions', '구독한 채널의 최근 영상')
  const { userId } = useAuth()
  const subs = useSubscriptions()
  // Quota-aware: one server call covers up to 20 channels (uploads playlists, never search).
  const channelIds = useMemo(() => (subs.data ?? []).slice(0, FEED_CHANNELS).map((s) => s.youtube_channel_id), [subs.data])
  const feed = useQuery({ queryKey: qk.feed(userId ?? 'anon', channelIds), queryFn: () => getSubscriptionFeed(channelIds, 5), enabled: channelIds.length > 0, staleTime: 10 * 60_000 })

  const active = useMemo(() => {
    const withVideos = new Set((feed.data ?? []).map((v) => v.channelId))
    return (subs.data ?? []).filter((s) => withVideos.has(s.youtube_channel_id))
  }, [feed.data, subs.data])

  if (subs.isPending) return <VideoGridSkeleton />
  if (subs.isError) return <ErrorState error={subs.error} onRetry={() => void subs.refetch()} />
  if (subs.data.length === 0) {
    return (
      <EmptyState
        icon={<Users className="size-6" />}
        title="아직 구독한 채널이 없습니다"
        description="채널 페이지에서 Subscribe를 누르면 이곳에 최근 영상이 모입니다. (VUEBOX 내부 구독이며 YouTube 구독에는 영향이 없습니다)"
        action={
          <Link to="/discover" className="btn btn-primary">
            Discover 둘러보기
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <PageHeader title="Subscriptions" description="구독한 채널의 최근 영상" />

      {active.length > 0 && (
        <div className="scroll-x mb-6 -mx-1 px-1" aria-label="최근 영상이 있는 채널">
          {active.map((s) => (
            <Link key={s.id} to={`/channel/${s.youtube_channel_id}`} className="flex w-20 shrink-0 flex-col items-center gap-1 text-center text-xs">
              <Avatar src={s.avatar_url} name={s.channel_name} size={56} />
              <span className="w-full truncate">{s.channel_name}</span>
            </Link>
          ))}
        </div>
      )}

      {feed.isPending && <VideoGridSkeleton />}
      {feed.isError && <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />}
      {feed.data && feed.data.length === 0 && <EmptyState title="최근 영상이 없습니다" description="구독한 채널에 새 영상이 올라오면 이곳에 표시됩니다." />}
      {feed.data && feed.data.length > 0 && <VideoGrid videos={feed.data} />}
      {subs.data.length > FEED_CHANNELS && <p className="mt-4 text-sm text-text-secondary">API 사용량을 아끼기 위해 최근에 구독한 {FEED_CHANNELS}개 채널의 영상만 표시합니다.</p>}

      <details className="card mt-10 p-4">
        <summary className="cursor-pointer font-semibold">구독 관리 ({subs.data.length})</summary>
        <ul className="mt-2 divide-y divide-border">
          {subs.data.map((s) => (
            <ManageRow key={s.id} sub={s} />
          ))}
        </ul>
      </details>
    </div>
  )
}
