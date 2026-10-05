import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import type { PlaylistRow, Visibility } from '@/types/db'

interface Props {
  open: boolean
  playlist?: Pick<PlaylistRow, 'title' | 'description' | 'visibility'>
  busy?: boolean
  onClose: () => void
  onSubmit: (v: { title: string; description: string; visibility: Visibility }) => void
}

/** Create or edit a playlist. Remount (key) to reset fields. */
export function PlaylistFormModal({ open, playlist, busy, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState(playlist?.title ?? '')
  const [description, setDescription] = useState(playlist?.description ?? '')
  const [visibility, setVisibility] = useState<Visibility>(playlist?.visibility ?? 'private')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (title.trim()) onSubmit({ title: title.trim(), description: description.trim(), visibility })
  }

  return (
    <Modal
      open={open}
      title={playlist ? '재생목록 편집' : '새 재생목록'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            취소
          </button>
          <button type="submit" form="playlist-form" className="btn btn-primary" disabled={!title.trim() || busy}>
            {playlist ? '저장' : '만들기'}
          </button>
        </>
      }
    >
      <form id="playlist-form" onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          제목
          <input className="input" data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          설명 (선택)
          <textarea className="input min-h-20 py-2" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          공개 범위
          <select className="input" value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
            <option value="private">비공개 - 나만 볼 수 있음</option>
            <option value="public">공개 - 링크가 있는 누구나 볼 수 있음</option>
          </select>
        </label>
      </form>
    </Modal>
  )
}
