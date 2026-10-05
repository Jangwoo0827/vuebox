import { categoryName } from '@/constants/categories'
import { tokenize } from '@/features/recommendations/text'
import type { WatchHistoryRow } from '@/types/db'

export interface Stats {
  totalVideos: number
  totalSeconds: number
  averageSeconds: number
  completionRate: number
  topCategory: { name: string; seconds: number } | null
  topChannel: { name: string; seconds: number } | null
  categories: { name: string; seconds: number }[]
  channels: { name: string; seconds: number }[]
  topics: { word: string; count: number }[]
  /** Minutes watched per day for the last 14 days, oldest first. */
  daily: { date: string; minutes: number }[]
}

const secondsOf = (r: WatchHistoryRow) => (r.watched_seconds > 0 ? r.watched_seconds : r.progress_seconds)

function topBy<K extends string>(map: Map<K, number>, n: number) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

/** Aggregates watch_history rows (a row's last watch day is used for the daily chart). */
export function computeStats(rows: readonly WatchHistoryRow[], now = new Date()): Stats {
  const total = rows.reduce((a, r) => a + secondsOf(r), 0)
  const categories = new Map<string, number>()
  const channels = new Map<string, number>()
  const words = new Map<string, number>()

  for (const r of rows) {
    const s = secondsOf(r)
    if (r.category_id_snapshot) categories.set(categoryName(r.category_id_snapshot), (categories.get(categoryName(r.category_id_snapshot)) ?? 0) + s)
    if (r.channel_name_snapshot) channels.set(r.channel_name_snapshot, (channels.get(r.channel_name_snapshot) ?? 0) + s)
    if (r.title_snapshot) for (const w of new Set(tokenize(r.title_snapshot))) words.set(w, (words.get(w) ?? 0) + 1)
  }

  const daily: Stats['daily'] = []
  const byDay = new Map<string, number>()
  for (const r of rows) {
    const day = r.last_watched_at.slice(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + secondsOf(r) / 60)
  }
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10)
    daily.push({ date, minutes: Math.round(byDay.get(date) ?? 0) })
  }

  const toList = (m: Map<string, number>, n: number) => topBy(m, n).map(([name, seconds]) => ({ name, seconds }))
  const cats = toList(categories, 6)
  const chans = toList(channels, 6)
  return {
    totalVideos: rows.length,
    totalSeconds: total,
    averageSeconds: rows.length ? total / rows.length : 0,
    completionRate: rows.length ? rows.filter((r) => r.completed).length / rows.length : 0,
    topCategory: cats[0] ?? null,
    topChannel: chans[0] ?? null,
    categories: cats,
    channels: chans,
    topics: topBy(words, 12)
      .filter(([, c]) => c >= 2)
      .map(([word, count]) => ({ word, count })),
    daily,
  }
}
