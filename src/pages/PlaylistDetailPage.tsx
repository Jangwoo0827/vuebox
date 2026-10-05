import { ArrowDown, ArrowUp, Globe, Link2, ListVideo, Lock, Pencil, Play, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/Section'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StateViews'
import { coverUrl } from '@/components/video/PlaylistCard'
import { PlaylistFormModal } from '@/components/video/PlaylistFormModal'
import { VideoRow } from '@/components/video/VideoRow'
import { useAuth } from '@/hooks/useAuth'
import { useVideos } from '@/hooks/useLibrary'
import { usePageTitle } from '@/hooks/usePageTitle'
import { usePlaylist, usePlaylistActions, usePlaylistItems } from '@/hooks/usePlaylists'
import { AppError } from '@/lib/errors'
import { toast } from '@/stores/toastStore'
import type { PlaylistItemRow } from '@/types/db'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function PlaylistDetailPage() {
  const { id = '' } = useParams()
  if (!UUID.test(id)) return <ErrorState error={new AppError('NOT_FOUND', 'invalid playlist id')} />
  return <PlaylistView id={id} />
}

function PlaylistView({ id }: { id: string }) {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const playlistQ = usePlaylist(id)
  const itemsQ = usePlaylistItems(id)
  const items = itemsQ.data ?? []
  const videos = useVideos(items.map((i) => i.video_id), items.length > 0)
  const { rename, remove, removeItem, reorder } = usePlaylistActions()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const playlist = playlistQ.data
  usePageTitle(playlist?.title ?? '재생목록')

  if (playlistQ.isPending) return <LoadingState />
  if (playlistQ.isError) return <ErrorState error={playlistQ.error} onRetry={() => void playlistQ.refetch()} />
  // RLS hides private playlists of other users, so "not found" also covers "not yours".
  if (!playlist) return <ErrorState error={new AppError('NOT_FOUND', 'playlist not found')} message="재생목록을 찾을 수 없거나 비공개입니다." />

  const owner = playlist.user_id === userId
  const byId = new Map((videos.data ?? []).map((v) => [v.id, v]))
  const first = items[0]

  const move = (index: number, delta: -1 | 1) => {
    const next = [...items]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    reorder.mutate({ playlistId: id, items: next })
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/playlist/${id}`)
      toast.success('링크를 복사했습니다.')
    } catch {
      toast.error('링크를 복사하지 못했습니다.')
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={playlist.title}
        description={[playlist.description, `동영상 ${items.length}개`, playlist.visibility === 'public' ? '공개' : '비공개'].filter(Boolean).join(' · ')}
        actions={
          <>
            {first && (
              <Link to={`/watch/${first.video_id}?list=${id}`} className="btn btn-primary">
                <Play className="size-4" aria-hidden /> Play All
              </Link>
            )}
            {playlist.visibility === 'public' && (
              <button type="button" className="btn btn-secondary" onClick={() => void copyLink()}>
                <Link2 className="size-4" aria-hidden /> 링크 복사
              </button>
            )}
            {owner && (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" aria-hidden /> 편집
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => rename.mutate({ id, visibility: playlist.visibility === 'public' ? 'private' : 'public' })} aria-label="공개 범위 전환">
                  {playlist.visibility === 'public' ? <Globe className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                  {playlist.visibility === 'public' ? '공개' : '비공개'}
                </button>
                <button type="button" className="btn btn-secondary text-danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4" aria-hidden /> 삭제
                </button>
              </>
            )}
          </>
        }
      />

      {itemsQ.isPending && <LoadingState />}
      {itemsQ.isError && <ErrorState error={itemsQ.error} onRetry={() => void itemsQ.refetch()} />}
      {itemsQ.isSuccess && items.length === 0 && (
        <EmptyState icon={<ListVideo className="size-6" />} title="재생목록이 비어 있습니다." description={owner ? '영상 페이지의 Save 버튼으로 영상을 추가하세요.' : undefined} />
      )}

      <ol className="flex flex-col gap-2">
        {items.map((item: PlaylistItemRow, index) => {
          const v = byId.get(item.video_id)
          const actions = owner && (
            <div className="flex items-center">
              <button type="button" className="icon-btn !size-9" aria-label="위로 이동" disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)}>
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button type="button" className="icon-btn !size-9" aria-label="아래로 이동" disabled={index === items.length - 1 || reorder.isPending} onClick={() => move(index, 1)}>
                <ArrowDown className="size-4" aria-hidden />
              </button>
              <button type="button" className="icon-btn !size-9 text-text-secondary" aria-label="재생목록에서 삭제" onClick={() => removeItem.mutate({ playlistId: id, itemId: item.id })}>
                <X className="size-4" aria-hidden />
              </button>
            </div>
          )
          return (
            <li key={item.id} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center text-sm tabular-nums text-text-secondary">{index + 1}</span>
              <div className="min-w-0 flex-1">
                {v ? (
                  <VideoRow video={v} playlistId={id} actions={actions || undefined} />
                ) : videos.isPending ? (
                  <div className="skeleton h-20 w-full" aria-hidden />
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-2 text-sm text-text-secondary">
                    <img src={coverUrl(item.video_id) ?? ''} alt="" className="aspect-video w-32 shrink-0 rounded object-cover opacity-50" referrerPolicy="no-referrer" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.title_snapshot ?? '사용할 수 없는 영상'}</span>
                      <span className="block text-xs">삭제되었거나 비공개인 영상입니다.</span>
                    </span>
                    {actions}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {editing && (
        <PlaylistFormModal
          open
          playlist={playlist}
          busy={rename.isPending}
          onClose={() => setEditing(false)}
          onSubmit={(v) => rename.mutate({ id, ...v }, { onSuccess: () => setEditing(false) })}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="재생목록 삭제"
        danger
        confirmLabel="삭제"
        busy={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate(id, { onSuccess: () => navigate('/playlists', { replace: true }), onSettled: () => setConfirmDelete(false) })}
      >
        '{playlist.title}' 재생목록을 삭제하시겠습니까? 영상 자체는 삭제되지 않습니다.
      </ConfirmDialog>
    </div>
  )
}
