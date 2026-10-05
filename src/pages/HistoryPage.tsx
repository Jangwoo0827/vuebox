import { History as HistoryIcon, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/Section'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StateViews'
import { HistoryItem } from '@/components/video/HistoryItem'
import { useHistoryList } from '@/hooks/useHistory'
import { useVideos } from '@/hooks/useLibrary'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSettings } from '@/hooks/useSettings'

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })

export default function HistoryPage() {
  usePageTitle('History', '시청 기록')
  const history = useHistoryList()
  const { settings } = useSettings()
  const [confirm, setConfirm] = useState(false)
  const videos = useVideos(history.items.map((e) => e.video_id), history.items.length > 0)
  const byId = useMemo(() => new Map((videos.data ?? []).map((v) => [v.id, v])), [videos.data])

  const groups = useMemo(() => {
    const out: { day: string; rows: typeof history.items }[] = []
    for (const e of history.items) {
      const day = dayLabel(e.last_watched_at)
      const last = out[out.length - 1]
      if (last?.day === day) last.rows.push(e)
      else out.push({ day, rows: [e] })
    }
    return out
  }, [history.items])

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="History"
        description="시청 기록은 계정에 저장되어 모든 기기에서 동일하게 보입니다"
        actions={
          history.items.length > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => setConfirm(true)}>
              전체 삭제
            </button>
          )
        }
      />
      {!settings.save_watch_history && (
        <p className="mb-4 rounded-lg border border-border bg-surface p-3 text-sm text-text-secondary">
          시청 기록 저장이 꺼져 있어 새 영상은 기록되지 않습니다. <Link to="/settings" className="text-accent underline">설정</Link>에서 변경할 수 있습니다.
        </p>
      )}

      {history.isPending && <LoadingState />}
      {history.isError && <ErrorState error={history.error} onRetry={() => void history.refetch()} />}
      {history.isSuccess && history.items.length === 0 && (
        <EmptyState icon={<HistoryIcon className="size-6" />} title="아직 시청 기록이 없습니다." description="영상을 시청하면 이곳에 기록되고, 이어보기가 가능해집니다." action={<Link to="/" className="btn btn-primary">영상 둘러보기</Link>} />
      )}

      {groups.map((g) => (
        <section key={g.day} className="mb-6" aria-label={g.day}>
          <h2 className="mb-2 text-sm font-semibold text-text-secondary">{g.day}</h2>
          <div className="flex flex-col gap-1">
            {g.rows.map((e) => (
              <HistoryItem key={e.id} entry={e} video={byId.get(e.video_id)} onRemove={() => history.remove.mutate(e.id)} />
            ))}
          </div>
        </section>
      ))}

      {history.hasNextPage && (
        <div className="flex justify-center py-4">
          <button type="button" className="btn btn-secondary" onClick={() => void history.fetchNextPage()} disabled={history.isFetchingNextPage}>
            {history.isFetchingNextPage ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} 더 보기
          </button>
        </div>
      )}

      <ConfirmDialog open={confirm} title="시청 기록 전체 삭제" danger confirmLabel="모두 삭제" busy={history.clear.isPending} onClose={() => setConfirm(false)} onConfirm={() => history.clear.mutate(undefined, { onSettled: () => setConfirm(false) })}>
        모든 시청 기록과 이어보기 위치가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
      </ConfirmDialog>
    </div>
  )
}
