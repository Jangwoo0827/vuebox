import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/queryKeys'
import { clearSearchHistory, deleteSearch, listSearchHistory, saveSearch } from '@/services/historyService'
import type { SearchHistoryRow } from '@/types/db'
import { useAuth } from './useAuth'
import { useSettings } from './useSettings'

export function useSearchHistory(limit = 10) {
  const { userId } = useAuth()
  const { settings } = useSettings()
  const qc = useQueryClient()
  const key = qk.searchHistory(userId ?? 'anon')

  const query = useQuery({
    queryKey: key,
    queryFn: () => listSearchHistory(userId!, 30),
    enabled: !!userId,
    staleTime: 2 * 60_000,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteSearch(userId!, id),
    onMutate: (id) => {
      qc.setQueryData<SearchHistoryRow[]>(key, (old = []) => old.filter((r) => r.id !== id))
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  })

  const clear = useMutation({
    mutationFn: () => clearSearchHistory(userId!),
    onMutate: () => qc.setQueryData<SearchHistoryRow[]>(key, []),
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  })

  const record = async (q: string) => {
    if (!userId || !settings.save_search_history) return
    try {
      await saveSearch(userId, q)
      void qc.invalidateQueries({ queryKey: key })
    } catch {
      /* history is best-effort */
    }
  }

  return { items: (query.data ?? []).slice(0, limit), all: query.data ?? [], remove: remove.mutate, clear: clear.mutate, record, enabled: !!userId && settings.save_search_history }
}
