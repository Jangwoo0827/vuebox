import { AppError, type AppErrorCode } from '@/lib/errors'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import type {
  Channel,
  Page,
  PlaylistSummary,
  SearchParams,
  Video,
  VideoCategory,
} from '@/types/youtube'

interface Envelope<T> {
  data?: T
  error?: { code: string; message: string }
}

const KNOWN: readonly AppErrorCode[] = [
  'QUOTA_EXCEEDED',
  'RATE_LIMITED',
  'NOT_FOUND',
  'UNAUTHENTICATED',
  'YOUTUBE_API_ERROR',
  'CHART_UNAVAILABLE',
  'BAD_REQUEST',
]

/** All YouTube Data API access goes through the `youtube` Edge Function (the API key stays server-side). */
async function call<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token ?? env.supabasePublishableKey

  let res: Response
  try {
    res = await fetch(`${env.supabaseUrl}/functions/v1/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: env.supabasePublishableKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, params }),
    })
  } catch {
    throw new AppError('NETWORK', 'network')
  }

  const body = (await res.json().catch(() => null)) as Envelope<T> | null
  if (res.ok && body?.data !== undefined) return body.data

  const code = body?.error?.code as AppErrorCode | undefined
  throw new AppError(code && KNOWN.includes(code) ? code : res.status === 404 ? 'NOT_FOUND' : 'YOUTUBE_API_ERROR', body?.error?.message ?? `HTTP ${res.status}`)
}

type SearchKind<T> = Page<T> & { kind: string }

/** search.list is the most expensive call (100 units): only used for explicit user searches. */
export const searchVideos = (p: Omit<SearchParams, 'type'>) => call<SearchKind<Video>>('search', { ...p, type: 'video' })
export const searchChannels = (p: Pick<SearchParams, 'q' | 'pageToken' | 'regionCode'>) => call<SearchKind<Channel>>('search', { ...p, type: 'channel' })
export const searchPlaylists = (p: Pick<SearchParams, 'q' | 'pageToken' | 'regionCode'>) => call<SearchKind<PlaylistSummary>>('search', { ...p, type: 'playlist' })

const chunk = <T,>(arr: T[], size: number): T[][] => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size))

/** Fetch metadata for any number of ids (50 per request, 1 quota unit each). Unavailable videos are omitted. */
export async function getVideoDetails(ids: string[], full = false): Promise<Video[]> {
  const unique = [...new Set(ids)]
  const pages = await Promise.all(chunk(unique, 50).map((c) => call<{ items: Video[] }>('videos', { ids: c, full })))
  const byId = new Map(pages.flatMap((p) => p.items).map((v) => [v.id, v]))
  return unique.map((id) => byId.get(id)).filter((v): v is Video => !!v)
}

export const getChannelDetails = async (ids: string[]): Promise<Channel[]> => {
  const pages = await Promise.all(chunk([...new Set(ids)], 50).map((c) => call<{ items: Channel[] }>('channels', { ids: c })))
  return pages.flatMap((p) => p.items)
}

export const getTrendingVideos = (p: { regionCode: string; categoryId?: string; pageToken?: string; maxResults?: number }) =>
  call<Page<Video> & { unavailable: boolean }>('trending', p)

export const getCategoryVideos = (p: { regionCode: string; categoryId: string; pageToken?: string; maxResults?: number }) => getTrendingVideos(p)

export const getVideoCategories = (regionCode: string) => call<{ items: VideoCategory[] }>('categories', { regionCode }).then((r) => r.items)

export const getChannelVideos = (p: { channelId: string; pageToken?: string; maxResults?: number }) => call<Page<Video>>('uploads', p)

/** Every upload (up to 2,000, newest first) so the page can sort by views or oldest-first. */
export const getChannelUploadsAll = (channelId: string) => call<{ items: Video[]; truncated: boolean }>('uploadsAll', { channelId })

export const getChannelPlaylists = (p: { channelId: string; pageToken?: string }) => call<Page<PlaylistSummary>>('channelPlaylists', p)

export const getPlaylistVideos = (p: { playlistId: string; pageToken?: string }) =>
  call<Page<Video> & { playlist: PlaylistSummary | null }>('playlistVideos', p)

export const getSubscriptionFeed = (channelIds: string[], perChannel = 4) =>
  call<{ items: Video[] }>('feed', { channelIds: channelIds.slice(0, 20), perChannel }).then((r) => r.items)
