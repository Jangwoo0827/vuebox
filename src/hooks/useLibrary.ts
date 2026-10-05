import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { ACTION_WEIGHTS } from '@/features/recommendations/config'
import { signalFromVideo } from '@/features/recommendations/profile'
import { signalQueue } from '@/features/recommendations/signalQueue'
import { userMessage } from '@/lib/errors'
import { qk } from '@/lib/queryKeys'
import { addVideoRef, listSubscriptions, listVideoRefs, removeVideoRef, subscribe, unsubscribe, type VideoListTable } from '@/services/libraryService'
import { getVideoDetails } from '@/services/youtubeService'
import { toast } from '@/stores/toastStore'
import type { SubscriptionRow, VideoRef } from '@/types/db'
import type { Channel, Video } from '@/types/youtube'
import { useAuth } from './useAuth'
import { useRequireAuth } from './useRequireAuth'

/** Metadata for a list of video ids, fetched fresh from YouTube (cached; 50 ids per quota unit). */
export function useVideos(ids: readonly string[], enabled = true) {
  return useQuery({
    queryKey: qk.videos(ids),
    queryFn: () => getVideoDetails([...ids]),
    enabled: enabled && ids.length > 0,
    staleTime: 10 * 60_000,
  })
}

export function useVideoRefs(table: VideoListTable) {
  const { userId } = useAuth()
  return useQuery({
    queryKey: qk.refs(table, userId ?? 'anon'),
    queryFn: () => listVideoRefs(table, userId!),
    enabled: !!userId,
    staleTime: 2 * 60_000,
  })
}

const LABELS: Record<VideoListTable, { on: string; off: string }> = {
  watch_later: { on: '나중에 볼 영상에 저장했습니다.', off: '나중에 볼 영상에서 삭제했습니다.' },
  favorites: { on: '즐겨찾기에 추가했습니다.', off: '즐겨찾기에서 삭제했습니다.' },
  video_likes: { on: '좋아요를 눌렀습니다.', off: '좋아요를 취소했습니다.' },
}

const SIGNALS: Record<VideoListTable, { weight: number; event: 'like' | 'save' }> = {
  video_likes: { weight: ACTION_WEIGHTS.like, event: 'like' },
  favorites: { weight: ACTION_WEIGHTS.favorite, event: 'save' },
  watch_later: { weight: ACTION_WEIGHTS.watchLater, event: 'save' },
}

/** Toggle state + optimistic mutation for like / favorite / watch-later on one video. */
export function useVideoToggle(table: VideoListTable, videoId: string) {
  const { userId } = useAuth()
  const qc = useQueryClient()
  const requireAuth = useRequireAuth()
  const { data } = useVideoRefs(table)
  const active = useMemo(() => !!data?.some((r) => r.video_id === videoId), [data, videoId])

  const mutation = useMutation({
    mutationFn: async ({ uid, on }: { uid: string; on: boolean }) => (on ? addVideoRef(table, uid, videoId) : removeVideoRef(table, uid, videoId)),
    onMutate: async ({ uid, on }) => {
      const key = qk.refs(table, uid)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<VideoRef[]>(key)
      qc.setQueryData<VideoRef[]>(key, (old = []) =>
        on ? [{ id: `tmp-${videoId}`, video_id: videoId, created_at: new Date().toISOString() }, ...old] : old.filter((r) => r.video_id !== videoId),
      )
      return { prev, key }
    },
    onError: (e, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev)
      toast.error(userMessage(e))
    },
    onSettled: (_d, _e, v) => void qc.invalidateQueries({ queryKey: qk.refs(table, v.uid) }),
  })

  const toggle = useCallback(
    (video?: Video) =>
      requireAuth((uid) => {
        const on = !active
        mutation.mutate({ uid, on })
        toast.success(on ? LABELS[table].on : LABELS[table].off)
        if (on && video) {
          signalQueue.addSignal(signalFromVideo(video, SIGNALS[table].weight))
          signalQueue.addEvent({ videoId, type: SIGNALS[table].event })
        }
      })(),
    [requireAuth, active, mutation, table, videoId],
  )

  return { active, toggle, enabled: !!userId, pending: mutation.isPending }
}

export function useSubscriptions() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: qk.subscriptions(userId ?? 'anon'),
    queryFn: () => listSubscriptions(userId!),
    enabled: !!userId,
    staleTime: 2 * 60_000,
  })
}

export function useSubscriptionToggle(channel: Pick<Channel, 'id' | 'title' | 'avatar'> | null) {
  const { data } = useSubscriptions()
  const qc = useQueryClient()
  const requireAuth = useRequireAuth()
  const channelId = channel?.id ?? ''
  const subscribed = !!data?.some((s) => s.youtube_channel_id === channelId)

  const mutation = useMutation({
    mutationFn: async ({ uid, on }: { uid: string; on: boolean }) => {
      if (on) await subscribe(uid, channel!)
      else await unsubscribe(uid, channelId)
    },
    onMutate: async ({ uid, on }) => {
      const key = qk.subscriptions(uid)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<SubscriptionRow[]>(key)
      qc.setQueryData<SubscriptionRow[]>(key, (old = []) =>
        on
          ? [{ id: `tmp-${channelId}`, youtube_channel_id: channelId, channel_name: channel!.title, avatar_url: channel!.avatar, created_at: new Date().toISOString() }, ...old]
          : old.filter((s) => s.youtube_channel_id !== channelId),
      )
      return { prev, key }
    },
    onError: (e, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev)
      toast.error(userMessage(e))
    },
    onSettled: (_d, _e, v) => {
      void qc.invalidateQueries({ queryKey: qk.subscriptions(v.uid) })
      void qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  const toggle = useCallback(
    () =>
      requireAuth((uid) => {
        if (!channel) return
        const on = !subscribed
        mutation.mutate({ uid, on })
        if (on) signalQueue.addSignal({ weight: ACTION_WEIGHTS.subscribe, channelId: channel.id })
        toast.success(on ? `${channel.title} 채널을 구독했습니다.` : '구독을 취소했습니다.')
      })(),
    [requireAuth, channel, subscribed, mutation],
  )

  return { subscribed, toggle }
}
