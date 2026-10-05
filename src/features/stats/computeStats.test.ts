import { describe, expect, it } from 'vitest'
import type { WatchHistoryRow } from '@/types/db'
import { computeStats } from './computeStats'

const NOW = new Date('2026-10-05T12:00:00Z')

function row(over: Partial<WatchHistoryRow>): WatchHistoryRow {
  return {
    id: crypto.randomUUID(),
    user_id: 'u',
    video_id: 'AAAAAAAAAAA',
    title_snapshot: 'Rust tutorial basics',
    thumbnail_snapshot: null,
    channel_id_snapshot: 'UC1',
    channel_name_snapshot: 'Rustacean',
    category_id_snapshot: '28',
    duration_seconds: 600,
    progress_seconds: 300,
    watch_percentage: 50,
    watched_seconds: 300,
    completed: false,
    started_at: '2026-10-05T10:00:00Z',
    last_watched_at: '2026-10-05T10:00:00Z',
    ...over,
  }
}

describe('computeStats', () => {
  it('handles empty history', () => {
    const s = computeStats([], NOW)
    expect(s.totalVideos).toBe(0)
    expect(s.completionRate).toBe(0)
    expect(s.topCategory).toBeNull()
    expect(s.daily).toHaveLength(14)
  })

  it('aggregates time, completion, categories and channels', () => {
    const s = computeStats(
      [
        row({ watched_seconds: 600, completed: true }),
        row({ watched_seconds: 300, category_id_snapshot: '10', channel_name_snapshot: 'DJ' }),
        row({ watched_seconds: 0, progress_seconds: 100, category_id_snapshot: '10', channel_name_snapshot: 'DJ' }),
      ],
      NOW,
    )
    expect(s.totalVideos).toBe(3)
    expect(s.totalSeconds).toBe(1000) // falls back to progress when watched_seconds is 0
    expect(s.completionRate).toBeCloseTo(1 / 3)
    expect(s.topCategory).toEqual({ name: 'Science & Technology', seconds: 600 })
    expect(s.topChannel?.name).toBe('Rustacean')
    expect(s.categories.map((c) => c.name)).toEqual(['Science & Technology', 'Music'])
  })

  it('puts minutes on the right day and extracts repeated topics', () => {
    const s = computeStats([row({ watched_seconds: 1200 }), row({ watched_seconds: 600, last_watched_at: '2026-10-04T08:00:00Z' })], NOW)
    expect(s.daily.at(-1)).toEqual({ date: '2026-10-05', minutes: 20 })
    expect(s.daily.at(-2)).toEqual({ date: '2026-10-04', minutes: 10 })
    expect(s.topics.map((t) => t.word)).toContain('rust')
  })
})
