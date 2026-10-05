/** Row types for the Supabase tables the app reads/writes (see supabase/migrations). */
export type ThemePreference = 'dark' | 'light' | 'system'

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string
  created_at: string
  updated_at: string
}

export interface UserSettings {
  user_id: string
  theme: ThemePreference
  autoplay: boolean
  save_watch_history: boolean
  save_search_history: boolean
  personalization: boolean
  notifications_enabled: boolean
  region: string
  default_playback_rate: number
}

export interface WatchHistoryRow {
  id: string
  user_id: string
  video_id: string
  title_snapshot: string | null
  thumbnail_snapshot: string | null
  channel_id_snapshot: string | null
  channel_name_snapshot: string | null
  category_id_snapshot: string | null
  duration_seconds: number
  progress_seconds: number
  watch_percentage: number
  watched_seconds: number
  completed: boolean
  started_at: string
  last_watched_at: string
}

export interface SearchHistoryRow {
  id: string
  query: string
  created_at: string
}

export interface VideoRef {
  id: string
  video_id: string
  created_at: string
}

export interface SubscriptionRow {
  id: string
  youtube_channel_id: string
  channel_name: string
  avatar_url: string | null
  created_at: string
}

export type Visibility = 'private' | 'public'

export interface PlaylistRow {
  id: string
  user_id: string
  title: string
  description: string
  visibility: Visibility
  created_at: string
  updated_at: string
}

export interface PlaylistItemRow {
  id: string
  playlist_id: string
  video_id: string
  title_snapshot: string | null
  thumbnail_snapshot: string | null
  channel_name_snapshot: string | null
  position: number
  created_at: string
}

export type NotificationType = 'recommendation' | 'subscription' | 'playlist' | 'reminder' | 'system'

export interface NotificationRow {
  id: string
  type: NotificationType
  title: string
  message: string
  reference_id: string | null
  read: boolean
  created_at: string
}

export interface VideoNoteRow {
  id: string
  video_id: string
  timestamp_seconds: number
  content: string
  created_at: string
  updated_at: string
}

export type ScoreMap = Record<string, number>

export interface RecommendationProfileRow {
  user_id: string
  preferred_categories: string[]
  preferred_keywords: string[]
  preferred_channels: string[]
  category_scores: ScoreMap
  keyword_scores: ScoreMap
  channel_scores: ScoreMap
  last_updated_at: string
}

export type RecommendationEventType = 'impression' | 'click' | 'play' | 'pause' | 'complete' | 'skip' | 'save' | 'like'
