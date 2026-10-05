import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/Section'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StateViews'
import { VideoRow } from '@/components/video/VideoRow'
import { useAuth } from '@/hooks/useAuth'
import { useVideoRefs, useVideos } from '@/hooks/useLibrary'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/queryKeys'
import { toast } from '@/stores/toastStore'
import { removeVideoRef, type VideoListTable } from '@/services/libraryService'

interface Props {
  table: VideoListTable
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
  icon: ReactNode
}

/** Shared page for Watch Later, Favorites and Liked videos (all are lists of video ids). */
export function SavedVideosPage({ table, title, description, emptyTitle, emptyDescription, icon }: Props) {
  usePageTitle(title, description)
  const { userId } = useAuth()
  const qc = useQueryClient()
  const refs = useVideoRefs(table)
  const ids = (refs.data ?? []).map((r) => r.video_id)
  const videos = useVideos(ids, ids.length > 0)
  const byId = new Map((videos.data ?? []).map((v) => [v.id, v]))

  const remove = async (videoId: string) => {
    if (!userId) return
    try {
      await removeVideoRef(table, userId, videoId)
      await qc.invalidateQueries({ queryKey: qk.refs(table, userId) })
    } catch {
      toast.error('삭제하지 못했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={title} description={description} />
      {refs.isPending && <LoadingState />}
      {refs.isError && <ErrorState error={refs.error} onRetry={() => void refs.refetch()} />}
      {refs.isSuccess && ids.length === 0 && <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} action={<Link to="/" className="btn btn-primary">영상 둘러보기</Link>} />}
      {videos.isError && <ErrorState compact error={videos.error} onRetry={() => void videos.refetch()} />}

      <div className="flex flex-col gap-2">
        {ids.map((id) => {
          const v = byId.get(id)
          if (!v) return videos.isPending ? null : <UnavailableRow key={id} videoId={id} onRemove={() => void remove(id)} />
          return (
            <VideoRow
              key={id}
              video={v}
              actions={
                <button type="button" className="icon-btn text-text-secondary" aria-label={`${v.title} 목록에서 삭제`} onClick={() => void remove(id)}>
                  <X className="size-5" aria-hidden />
                </button>
              }
            />
          )
        })}
      </div>
    </div>
  )
}

/** A saved video that YouTube no longer returns (deleted / private). */
function UnavailableRow({ videoId, onRemove }: { videoId: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3 text-sm text-text-secondary">
      <span>사용할 수 없는 영상입니다 ({videoId}) — 삭제되었거나 비공개로 전환되었을 수 있습니다.</span>
      <button type="button" className="btn btn-secondary !min-h-9" onClick={onRemove}>
        목록에서 제거
      </button>
    </div>
  )
}
