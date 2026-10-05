import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/queryKeys'
import { userMessage } from '@/lib/errors'
import { clearHistory, deleteHistoryEntry, listHistory } from '@/services/historyService'
import { toast } from '@/stores/toastStore'
import type { WatchHistoryRow } from '@/types/db'
import { useAuth } from './useAuth'

const PAGE = 30

/** Cursor-paginated (by last_watched_at) watch history. */
export function useHistoryList() {
  const { userId } = useAuth()
  const qc = useQueryClient()
  const key = [...qk.history(userId ?? 'anon'), 'list'] as const

  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => listHistory(userId!, PAGE, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1]?.last_watched_at : undefined),
    enabled: !!userId,
    staleTime: 60_000,
  })

  const refresh = () => {
    if (!userId) return
    void qc.invalidateQueries({ queryKey: qk.history(userId) })
    void qc.invalidateQueries({ queryKey: qk.continueWatching(userId) })
  }

  const remove = useMutation({
    mutationFn: (id: string) => deleteHistoryEntry(userId!, id),
    onSuccess: refresh,
    onError: (e) => toast.error(userMessage(e)),
  })
  const clear = useMutation({
    mutationFn: () => clearHistory(userId!),
    onSuccess: () => {
      refresh()
      toast.success('시청 기록을 모두 삭제했습니다.')
    },
    onError: (e) => toast.error(userMessage(e)),
  })

  const items: WatchHistoryRow[] = query.data?.pages.flat() ?? []
  return { ...query, items, remove, clear }
}
