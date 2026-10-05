import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/queryKeys'
import { userMessage } from '@/lib/errors'
import { ACTION_WEIGHTS } from '@/features/recommendations/config'
import { signalFromVideo } from '@/features/recommendations/profile'
import { signalQueue } from '@/features/recommendations/signalQueue'
import {
  addToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listPlaylistItems,
  listPlaylists,
  playlistsContaining,
  removeFromPlaylist,
  reorderPlaylist,
  updatePlaylist,
} from '@/services/playlistService'
import { createNotification } from '@/services/notificationService'
import { toast } from '@/stores/toastStore'
import type { PlaylistItemRow, Visibility } from '@/types/db'
import type { Video } from '@/types/youtube'
import { useAuth } from './useAuth'
import { useSettings } from './useSettings'

export function usePlaylists() {
  const { userId } = useAuth()
  return useQuery({ queryKey: qk.playlists(userId ?? 'anon'), queryFn: () => listPlaylists(userId!), enabled: !!userId, staleTime: 60_000 })
}

export function usePlaylist(id: string | undefined) {
  return useQuery({ queryKey: qk.playlist(id ?? 'none'), queryFn: () => getPlaylist(id!), enabled: !!id, staleTime: 60_000 })
}

export function usePlaylistItems(id: string | undefined) {
  return useQuery({ queryKey: qk.playlistItems(id ?? 'none'), queryFn: () => listPlaylistItems(id!), enabled: !!id, staleTime: 60_000 })
}

export function useContainingPlaylists(videoId: string, enabled: boolean) {
  const { userId } = useAuth()
  return useQuery({ queryKey: ['playlists-containing', userId, videoId], queryFn: () => playlistsContaining(userId!, videoId), enabled: !!userId && enabled })
}

/** All playlist mutations in one place; each invalidates the lists it affects and reports errors as toasts. */
export function usePlaylistActions() {
  const { userId } = useAuth()
  const { settings } = useSettings()
  const qc = useQueryClient()
  const refresh = (playlistId?: string) => {
    if (userId) void qc.invalidateQueries({ queryKey: qk.playlists(userId) })
    if (playlistId) {
      void qc.invalidateQueries({ queryKey: qk.playlistItems(playlistId) })
      void qc.invalidateQueries({ queryKey: qk.playlist(playlistId) })
    }
    void qc.invalidateQueries({ queryKey: ['playlists-containing'] })
  }
  const onError = (e: unknown) => toast.error(userMessage(e))

  const create = useMutation({
    mutationFn: (v: { title: string; description?: string; visibility?: Visibility }) => createPlaylist(userId!, v.title, v.description, v.visibility),
    onSuccess: () => refresh(),
    onError,
  })

  const rename = useMutation({
    mutationFn: (v: { id: string; title?: string; description?: string; visibility?: Visibility }) => {
      const { id, ...patch } = v
      return updatePlaylist(id, patch)
    },
    onSuccess: (_d, v) => refresh(v.id),
    onError,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deletePlaylist(id),
    onSuccess: () => refresh(),
    onError,
  })

  const add = useMutation({
    mutationFn: async (v: { playlistId: string; playlistTitle: string; video: Video }) => {
      const added = await addToPlaylist(v.playlistId, v.video)
      if (added) {
        signalQueue.addSignal(signalFromVideo(v.video, ACTION_WEIGHTS.playlistAdd))
        signalQueue.addEvent({ videoId: v.video.id, type: 'save' })
        if (userId && settings.notifications_enabled) {
          await createNotification(userId, { type: 'playlist', title: `'${v.playlistTitle}'에 영상을 추가했습니다`, message: v.video.title, referenceId: `${v.playlistId}:${v.video.id}` }).catch(() => undefined)
          void qc.invalidateQueries({ queryKey: qk.notifications(userId) })
        }
      }
      return added
    },
    onSuccess: (added, v) => {
      toast[added ? 'success' : 'info'](added ? `'${v.playlistTitle}'에 추가했습니다.` : '이미 재생목록에 있는 영상입니다.')
      refresh(v.playlistId)
    },
    onError,
  })

  const removeItem = useMutation({
    mutationFn: (v: { playlistId: string; itemId: string }) => removeFromPlaylist(v.itemId),
    onMutate: (v) => qc.setQueryData<PlaylistItemRow[]>(qk.playlistItems(v.playlistId), (old = []) => old.filter((i) => i.id !== v.itemId)),
    onSettled: (_d, _e, v) => refresh(v.playlistId),
    onError,
  })

  const reorder = useMutation({
    mutationFn: (v: { playlistId: string; items: PlaylistItemRow[] }) => reorderPlaylist(v.playlistId, v.items.map((i) => i.id)),
    onMutate: (v) => qc.setQueryData(qk.playlistItems(v.playlistId), v.items.map((i, idx) => ({ ...i, position: idx }))),
    onSettled: (_d, _e, v) => refresh(v.playlistId),
    onError,
  })

  return { create, rename, remove, add, removeItem, reorder }
}
