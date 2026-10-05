import { Clock, Compass, Film, FolderHeart, History, Home, ListVideo, type LucideIcon, Settings, Star, TrendingUp, BarChart3, Users } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/trending', label: 'Trending', icon: TrendingUp },
  { to: '/shorts', label: 'Shorts', icon: Film },
  { to: '/subscriptions', label: 'Subscriptions', icon: Users },
]

export const LIBRARY_NAV: NavItem[] = [
  { to: '/library', label: 'Library', icon: FolderHeart },
  { to: '/history', label: 'History', icon: History },
  { to: '/watch-later', label: 'Watch Later', icon: Clock },
  { to: '/favorites', label: 'Favorites', icon: Star },
  { to: '/playlists', label: 'Playlists', icon: ListVideo },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export const MOBILE_NAV: NavItem[] = [
  PRIMARY_NAV[0]!,
  PRIMARY_NAV[1]!,
  PRIMARY_NAV[3]!,
  PRIMARY_NAV[4]!,
  LIBRARY_NAV[0]!,
]
