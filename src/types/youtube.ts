/** Normalized shapes returned by the `youtube` Edge Function. Raw API payloads never reach the UI. */
export interface Video {
  id: string
  title: string
  description: string
  thumbnail: string
  channelId: string
  channelTitle: string
  publishedAt: string
  durationSeconds: number
  viewCount: number | null
  likeCount: number | null
  categoryId: string | null
  tags: string[]
  live: 'none' | 'live' | 'upcoming'
  embeddable: boolean
}

export interface Channel {
  id: string
  title: string
  description: string
  avatar: string
  banner: string | null
  customUrl: string | null
  subscriberCount: number | null
  videoCount: number | null
  uploadsPlaylistId: string
}

export interface PlaylistSummary {
  id: string
  title: string
  description: string
  thumbnail: string
  channelId: string
  channelTitle: string
  itemCount: number | null
}

export interface VideoCategory {
  id: string
  title: string
}

export interface Page<T> {
  items: T[]
  nextPageToken: string | null
}

export type SearchType = 'video' | 'channel' | 'playlist'
export type SearchOrder = 'relevance' | 'date' | 'viewCount'
export type SearchDuration = 'short' | 'medium' | 'long'

export interface SearchParams {
  q: string
  type?: SearchType
  order?: SearchOrder
  videoDuration?: SearchDuration
  videoDefinition?: 'high'
  eventType?: 'live'
  regionCode?: string
  pageToken?: string
}
