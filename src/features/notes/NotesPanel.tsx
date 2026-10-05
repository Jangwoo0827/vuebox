import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState } from '@/components/ui/StateViews'
import { useAuth } from '@/hooks/useAuth'
import { userMessage } from '@/lib/errors'
import { qk } from '@/lib/queryKeys'
import { addNote, deleteNote, listNotes, updateNote } from '@/services/notesService'
import { toast } from '@/stores/toastStore'
import { formatDuration, parseTimestamp } from '@/utils/format'

interface Props {
  videoId: string
  getTime: () => number
  onSeek: (seconds: number) => void
}

/** Private notes pinned to a moment in the video. Only the owner can ever read them (RLS). */
export function NotesPanel({ videoId, getTime, onSeek }: Props) {
  const { userId } = useAuth()
  const qc = useQueryClient()
  const key = qk.notes(userId ?? 'anon', videoId)
  const notes = useQuery({ queryKey: key, queryFn: () => listNotes(userId!, videoId), enabled: !!userId, staleTime: 60_000 })

  const [text, setText] = useState('')
  const [time, setTime] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)

  const onError = (e: unknown) => toast.error(userMessage(e))
  const refresh = () => void qc.invalidateQueries({ queryKey: key })

  const add = useMutation({ mutationFn: (v: { seconds: number; content: string }) => addNote(userId!, videoId, v.seconds, v.content), onSuccess: refresh, onError })
  const save = useMutation({ mutationFn: (v: { id: string; content: string }) => updateNote(userId!, v.id, v.content), onSuccess: () => { setEditing(null); refresh() }, onError })
  const del = useMutation({ mutationFn: (id: string) => deleteNote(userId!, id), onSuccess: refresh, onError })

  if (!userId) {
    return (
      <section className="card p-4" aria-label="개인 메모">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Lock className="size-4" aria-hidden /> 개인 메모
        </h2>
        <p className="text-sm text-text-secondary">
          <Link to="/login" className="text-accent underline">
            로그인
          </Link>
          하면 영상의 특정 시점에 나만 볼 수 있는 메모를 남길 수 있습니다.
        </p>
      </section>
    )
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    const seconds = time.trim() ? parseTimestamp(time) : Math.floor(getTime())
    if (seconds === null) {
      toast.error('시간은 1:23 또는 01:02:03 형식으로 입력해주세요.')
      return
    }
    add.mutate({ seconds, content }, { onSuccess: () => { setText(''); setTime('') } })
  }

  return (
    <section className="card p-4" aria-label="개인 메모">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Lock className="size-4" aria-hidden /> 개인 메모 <span className="text-xs font-normal text-text-secondary">나만 볼 수 있어요</span>
      </h2>
      <form onSubmit={onSubmit} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input className="input sm:w-28" value={time} onChange={(e) => setTime(e.target.value)} placeholder="현재 시점" aria-label="메모 시간 (비워두면 현재 재생 위치)" inputMode="numeric" maxLength={8} />
        <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="이 시점에 메모 남기기" aria-label="메모 내용" maxLength={1000} />
        <button type="submit" className="btn btn-primary" disabled={!text.trim() || add.isPending}>
          추가
        </button>
      </form>

      {notes.isError && <ErrorState compact error={notes.error} onRetry={() => void notes.refetch()} />}
      {notes.data?.length === 0 && <p className="text-sm text-text-secondary">아직 메모가 없습니다.</p>}
      <ul className="flex flex-col gap-2">
        {notes.data?.map((n) => (
          <li key={n.id} className="flex items-start gap-3 rounded-lg bg-surface-2 p-3">
            <button type="button" onClick={() => onSeek(n.timestamp_seconds)} className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-sm font-semibold tabular-nums text-accent hover:underline" aria-label={`${formatDuration(n.timestamp_seconds)} 위치로 이동`}>
              {formatDuration(n.timestamp_seconds)}
            </button>
            {editing?.id === n.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (editing.text.trim()) save.mutate({ id: n.id, content: editing.text })
                }}
              >
                <input className="input" autoFocus value={editing.text} maxLength={1000} onChange={(e) => setEditing({ id: n.id, text: e.target.value })} aria-label="메모 수정" />
                <button type="submit" className="btn btn-primary">저장</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>취소</button>
              </form>
            ) : (
              <>
                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">{n.content}</p>
                <button type="button" className="icon-btn !size-8" aria-label="메모 수정" onClick={() => setEditing({ id: n.id, text: n.content })}>
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button type="button" className="icon-btn !size-8" aria-label="메모 삭제" onClick={() => del.mutate(n.id)}>
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
