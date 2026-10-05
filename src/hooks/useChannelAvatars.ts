import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getChannelDetails } from '@/services/youtubeService'
import type { Video } from '@/types/youtube'

/** One batched channels.list call (1 quota unit, cached 1h) gives every card its channel avatar. */
export function useChannelAvatars(videos: readonly Pick<Video, 'channelId'>[]): ReadonlyMap<string, string> {
  const ids = useMemo(() => [...new Set(videos.map((v) => v.channelId).filter(Boolean))].slice(0, 50).sort(), [videos])
  const { data } = useQuery({
    queryKey: ['channel-avatars', ...ids],
    queryFn: () => getChannelDetails(ids),
    enabled: ids.length > 0,
    staleTime: 60 * 60_000,
    retry: false,
  })
  return useMemo(() => new Map((data ?? []).map((c) => [c.id, c.avatar])), [data])
}
