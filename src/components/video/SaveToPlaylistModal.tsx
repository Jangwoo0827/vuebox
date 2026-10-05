import { Check, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StateViews'
import { useContainingPlaylists, usePlaylistActions, usePlaylists } from '@/hooks/usePlaylists'
import type { Video } from '@/types/youtube'

/** Add one video to any of your playlists (or a new one). */
export function SaveToPlaylistModal({ video, open, onClose }: { video: Video; open: boolean; onClose: () => void }) {
  const lists = usePlaylists()
  const containing = useContainingPlaylists(video.id, open)
  const { add, create } = usePlaylistActions()
  const [title, setTitle] = useState('')

  const inList = new Set(containing.data ?? [])

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    const pl = await create.mutateAsync({ title: t })
    setTitle('')
    add.mutate({ playlistId: pl.id, playlistTitle: pl.title, video })
  }

  return (
    <Modal open={open} title="재생목록에 저장" onClose={onClose}>
      {lists.isLoading && <LoadingState />}
      {lists.isError && <ErrorState compact error={lists.error} onRetry={() => void lists.refetch()} />}
      {lists.data && lists.data.length === 0 && <EmptyState title="첫 번째 재생목록을 만들어보세요." />}
      {lists.data && lists.data.length > 0 && (
        <ul className="mb-4 flex flex-col gap-1">
          {lists.data.map((p) => {
            const saved = inList.has(p.id)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={saved || add.isPending}
                  onClick={() => add.mutate({ playlistId: p.id, playlistTitle: p.title, video })}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-surface-hover disabled:opacity-70"
                >
                  <span className={`flex size-5 items-center justify-center rounded border ${saved ? 'border-accent bg-accent text-white' : 'border-border'}`} aria-hidden>
                    {saved && <Check className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className="text-xs text-text-secondary">{p.item_count}개</span>
                  <span className="sr-only">{saved ? '이미 저장됨' : '저장'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <form onSubmit={onCreate} className="flex gap-2">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="새 재생목록 이름" aria-label="새 재생목록 이름" />
        <button type="submit" className="btn btn-primary shrink-0" disabled={!title.trim() || create.isPending}>
          <Plus className="size-4" aria-hidden /> 만들기
        </button>
      </form>
    </Modal>
  )
}
