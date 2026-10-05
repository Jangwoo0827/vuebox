import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/Section'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StateViews'
import { computeStats } from '@/features/stats/computeStats'
import { useAuth } from '@/hooks/useAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { qk } from '@/lib/queryKeys'
import { listHistoryForStats } from '@/services/historyService'
import { formatWatchTime } from '@/utils/format'

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 truncate text-2xl font-extrabold tracking-tight">{value}</p>
      {hint && <p className="truncate text-xs text-text-secondary">{hint}</p>}
    </div>
  )
}

/** Horizontal bar list; widths are relative to the largest value. */
function BarList({ title, rows, format }: { title: string; rows: { name: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <section className="card p-4" aria-label={title}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">아직 데이터가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <li key={r.name}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="truncate">{r.name}</span>
                <span className="shrink-0 tabular-nums text-text-secondary">{format(r.value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="presentation">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function StatsPage() {
  usePageTitle('Stats', '내 시청 통계')
  const { userId } = useAuth()
  const q = useQuery({ queryKey: qk.stats(userId ?? 'anon'), queryFn: () => listHistoryForStats(userId!), enabled: !!userId, staleTime: 5 * 60_000 })
  const stats = useMemo(() => (q.data ? computeStats(q.data) : null), [q.data])

  if (q.isPending) return <LoadingState />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />
  if (!stats || stats.totalVideos === 0) {
    return <EmptyState icon={<BarChart3 className="size-6" />} title="아직 통계가 없습니다" description="영상을 시청하면 시청 시간, 완료율, 관심 카테고리가 이곳에 표시됩니다." action={<Link to="/" className="btn btn-primary">영상 둘러보기</Link>} />
  }

  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.minutes))

  return (
    <div>
      <PageHeader title="Stats" description={`최근 시청한 ${stats.totalVideos}개 영상 기준`} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="시청한 영상" value={`${stats.totalVideos}개`} />
        <StatCard label="총 시청 시간" value={formatWatchTime(stats.totalSeconds)} />
        <StatCard label="평균 시청 시간" value={formatWatchTime(stats.averageSeconds)} hint="영상당" />
        <StatCard label="완료율" value={`${Math.round(stats.completionRate * 100)}%`} />
        <StatCard label="가장 많이 본 카테고리" value={stats.topCategory?.name ?? '-'} />
        <StatCard label="가장 많이 본 채널" value={stats.topChannel?.name ?? '-'} />
      </div>

      <section className="card mb-6 p-4" aria-label="최근 14일 시청 시간">
        <h2 className="mb-4 font-semibold">최근 활동 (분/일)</h2>
        <div className="flex h-40 items-end gap-1.5" role="img" aria-label={`최근 14일 일별 시청 시간: ${stats.daily.map((d) => `${d.date.slice(5)} ${d.minutes}분`).join(', ')}`}>
          {stats.daily.map((d) => (
            <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${d.minutes}분`}>
              <div className="w-full rounded-t bg-accent" style={{ height: `${Math.max(d.minutes > 0 ? 4 : 0, (d.minutes / maxDaily) * 100)}%` }} />
              <span className="text-[10px] text-text-secondary">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList title="카테고리별 시청 시간" rows={stats.categories.map((c) => ({ name: c.name, value: c.seconds }))} format={formatWatchTime} />
        <BarList title="채널별 시청 시간" rows={stats.channels.map((c) => ({ name: c.name, value: c.seconds }))} format={formatWatchTime} />
      </div>

      <section className="card mt-4 p-4" aria-label="주요 토픽">
        <h2 className="mb-3 font-semibold">Top Topics</h2>
        {stats.topics.length === 0 ? (
          <p className="text-sm text-text-secondary">더 많은 영상을 시청하면 자주 보는 주제가 표시됩니다.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {stats.topics.map((t) => (
              <li key={t.word}>
                <Link to={`/search?q=${encodeURIComponent(t.word)}`} className="chip">
                  {t.word} <span className="ml-1.5 text-text-secondary">{t.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
