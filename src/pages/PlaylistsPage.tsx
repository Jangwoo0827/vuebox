import { ListVideo, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/Section'
import { EmptyState, ErrorState } from '@/components/ui/StateViews'
import { VideoGridSkeleton } from '@/components/ui/Skeleton'
import { PlaylistCard } from '@/components/video/PlaylistCard'
import { PlaylistFormModal } from '@/components/video/PlaylistFormModal'
import { usePageTitle } from '@/hooks/usePageTitle'
import { usePlaylistActions, usePlaylists } from '@/hooks/usePlaylists'

export default function PlaylistsPage() {
  usePageTitle('Playlists', '내 재생목록')
  const lists = usePlaylists()
  const { create } = usePlaylistActions()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const newButton = (
    <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
      <Plus className="size-4" aria-hidden /> 새 재생목록
    </button>
  )

  return (
    <div>
      <PageHeader title="Playlists" description="재생목록은 계정에 저장되어 모든 기기에서 동기화됩니다" actions={newButton} />
      {lists.isPending && <VideoGridSkeleton count={4} />}
      {lists.isError && <ErrorState error={lists.error} onRetry={() => void lists.refetch()} />}
      {lists.isSuccess && lists.data.length === 0 && <EmptyState icon={<ListVideo className="size-6" />} title="첫 번째 재생목록을 만들어보세요." description="좋아하는 영상을 모아 순서대로 재생할 수 있습니다." action={newButton} />}
      <div className="grid grid-cols-1 gap-6 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {lists.data?.map((p) => (
          <PlaylistCard key={p.id} playlist={p} />
        ))}
      </div>
      {open && (
        <PlaylistFormModal
          open
          busy={create.isPending}
          onClose={() => setOpen(false)}
          onSubmit={(v) =>
            create.mutate(v, {
              onSuccess: (pl) => {
                setOpen(false)
                navigate(`/playlist/${pl.id}`)
              },
            })
          }
        />
      )}
    </div>
  )
}
