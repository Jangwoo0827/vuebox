import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/queryKeys'
import { deleteNotification, listNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/notificationService'
import type { NotificationRow } from '@/types/db'
import { useAuth } from './useAuth'

export function useNotifications() {
  const { userId } = useAuth()
  const qc = useQueryClient()
  const key = qk.notifications(userId ?? 'anon')

  const query = useQuery({
    queryKey: key,
    queryFn: () => listNotifications(userId!),
    enabled: !!userId,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })

  const patch = (fn: (rows: NotificationRow[]) => NotificationRow[]) => qc.setQueryData<NotificationRow[]>(key, (old = []) => fn(old))
  const settle = () => void qc.invalidateQueries({ queryKey: key })

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(userId!, id),
    onMutate: (id) => patch((rows) => rows.map((n) => (n.id === id ? { ...n, read: true } : n))),
    onSettled: settle,
  })
  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(userId!),
    onMutate: () => patch((rows) => rows.map((n) => ({ ...n, read: true }))),
    onSettled: settle,
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteNotification(userId!, id),
    onMutate: (id) => patch((rows) => rows.filter((n) => n.id !== id)),
    onSettled: settle,
  })

  const items = query.data ?? []
  return { items, unread: items.filter((n) => !n.read).length, isLoading: query.isLoading, isError: query.isError, markRead: markRead.mutate, markAllRead: markAll.mutate, remove: remove.mutate }
}
