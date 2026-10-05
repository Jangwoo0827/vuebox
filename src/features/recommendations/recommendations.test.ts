import { describe, expect, it } from 'vitest'
import type { Video } from '@/types/youtube'
import { applySignals, emptyProfile, signalFromQuery, signalFromVideo, watchInterestDelta, watchInterestWeight } from './profile'
import { RuleBasedRecommender, type RankingContext } from './ranker'
import { extractKeywords, tokenize } from './text'

const NOW = Date.parse('2026-10-05T00:00:00Z')

let n = 0
function video(over: Partial<Video> = {}): Video {
  n++
  return {
    id: `vid${String(n).padStart(8, '0')}`.slice(0, 11),
    title: `Video ${n}`,
    description: '',
    thumbnail: 'https://i.ytimg.com/x.jpg',
    channelId: `UC${String(n).padStart(22, '0')}`,
    channelTitle: `Channel ${n}`,
    publishedAt: new Date(NOW - 2 * 86_400_000).toISOString(),
    durationSeconds: 600,
    viewCount: 10_000,
    likeCount: null,
    categoryId: '24',
    tags: [],
    live: 'none',
    embeddable: true,
    ...over,
  }
}

const ctx = (over: Partial<RankingContext> = {}): RankingContext => ({
  profile: emptyProfile(new Date(NOW)),
  watched: new Map(),
  seeds: [],
  recentlyShown: new Set(),
  subscribedChannelIds: new Set(),
  now: NOW,
  ...over,
})

const rec = new RuleBasedRecommender()

describe('text', () => {
  it('tokenizes English and Korean and drops noise', () => {
    expect(tokenize('The Official 4K Minecraft Survival 123 마인크래프트 건축')).toEqual(['minecraft', 'survival', '마인크래프트', '건축'])
  })
  it('prefers tags, dedupes and limits keywords', () => {
    expect(extractKeywords('React hooks tutorial', ['react', 'typescript'], 3)).toEqual(['react', 'typescript', 'hooks'])
  })
})

describe('watch interest', () => {
  it('maps progress tiers to increasing weights', () => {
    const w = [5, 15, 30, 55, 85, 97].map(watchInterestWeight)
    expect(w).toEqual([0.05, 0.2, 0.5, 1, 2, 3])
    expect(w).toEqual([...w].sort((a, b) => a - b))
  })
  it('never double-counts or goes negative', () => {
    expect(watchInterestDelta(0, 60)).toBe(1 - 0.05)
    expect(watchInterestDelta(60, 60)).toBe(0)
    expect(watchInterestDelta(80, 20)).toBe(0)
  })
})

describe('profile updates', () => {
  it('accumulates category, channel and keyword interest and derives preferences', () => {
    const v = video({ title: 'Rust ownership explained', categoryId: '28', tags: ['rust'] })
    const p = applySignals(emptyProfile(new Date(NOW)), [signalFromVideo(v, 2), signalFromQuery('rust async')], new Date(NOW))
    expect(p.category_scores['28']).toBe(2)
    expect(p.channel_scores[v.channelId]).toBe(2)
    expect(p.keyword_scores.rust).toBeGreaterThan(p.keyword_scores.ownership!)
    expect(p.preferred_categories).toEqual(['28'])
    expect(p.preferred_keywords[0]).toBe('rust')
  })
  it('decays old interest by half every 30 days', () => {
    const base = applySignals(emptyProfile(new Date(NOW - 30 * 86_400_000)), [{ weight: 4, categoryId: '10' }], new Date(NOW - 30 * 86_400_000))
    const later = applySignals(base, [], new Date(NOW))
    expect(later.category_scores['10']).toBeCloseTo(2, 2)
  })
  it('prunes negligible scores', () => {
    const old = applySignals(emptyProfile(new Date(NOW - 400 * 86_400_000)), [{ weight: 1, categoryId: '1' }], new Date(NOW - 400 * 86_400_000))
    expect(applySignals(old, [], new Date(NOW)).category_scores).toEqual({})
  })
})

describe('RuleBasedRecommender', () => {
  it('ranks by watch history: categories the user watched come first', () => {
    const gaming = video({ categoryId: '20', title: 'Elden Ring boss guide' })
    const music = video({ categoryId: '10', title: 'Piano ballad cover' })
    const profile = applySignals(emptyProfile(new Date(NOW)), [signalFromVideo(video({ categoryId: '20', title: 'Elden Ring build' }), 3)], new Date(NOW))
    const out = rec.rank([music, gaming], ctx({ profile }), { limit: 2 })
    expect(out[0]!.video.id).toBe(gaming.id)
  })

  it('search interest raises matching keywords', () => {
    const match = video({ title: 'Learn Kubernetes in one hour', categoryId: '27' })
    const other = video({ title: 'Cute cats compilation', categoryId: '27' })
    const profile = applySignals(emptyProfile(new Date(NOW)), [signalFromQuery('kubernetes tutorial')], new Date(NOW))
    const out = rec.rank([other, match], ctx({ profile }), { limit: 2 })
    expect(out[0]!.video.id).toBe(match.id)
    expect(out[0]!.reasons).toContain('matching-keywords')
  })

  it('likes (strong signals) outweigh a single weak watch', () => {
    const liked = video({ title: 'Synthwave mix', categoryId: '10' })
    const clicked = video({ title: 'Cooking pasta', categoryId: '26' })
    let profile = applySignals(emptyProfile(new Date(NOW)), [signalFromVideo(clicked, 0.05)], new Date(NOW))
    profile = applySignals(profile, [signalFromVideo(liked, 2)], new Date(NOW))
    const a = video({ categoryId: '10' })
    const b = video({ categoryId: '26' })
    const out = rec.rank([b, a], ctx({ profile }), { limit: 2 })
    expect(out[0]!.video.id).toBe(a.id)
  })

  it('penalizes already-watched and recently shown videos', () => {
    const watched = video({ title: 'Seen it' })
    const shown = video({ title: 'Shown yesterday' })
    const fresh = video({ title: 'Brand new' })
    const out = rec.rank([watched, shown, fresh], ctx({ watched: new Map([[watched.id, 100]]), recentlyShown: new Set([shown.id]) }), { limit: 3 })
    expect(out.map((r) => r.video.id)).toEqual([fresh.id, shown.id, watched.id])
  })

  it('removes duplicates, excluded and non-embeddable videos', () => {
    const a = video()
    const blocked = video({ embeddable: false })
    const current = video()
    const out = rec.rank([a, a, blocked, current], ctx({ excludeIds: new Set([current.id]) }), { limit: 10 })
    expect(out.map((r) => r.video.id)).toEqual([a.id])
  })

  it('does not let one channel dominate', () => {
    const channelId = 'UCaaaaaaaaaaaaaaaaaaaaaa'
    const spam = Array.from({ length: 6 }, () => video({ channelId, viewCount: 5_000_000 }))
    const others = Array.from({ length: 4 }, () => video({ viewCount: 100 }))
    const out = rec.rank([...spam, ...others], ctx(), { limit: 6 })
    expect(out.filter((r) => r.video.channelId === channelId).length).toBeLessThanOrEqual(2)
    expect(out).toHaveLength(6)
  })

  it('keeps categories diverse', () => {
    const profile = applySignals(emptyProfile(new Date(NOW)), [{ weight: 5, categoryId: '20' }], new Date(NOW))
    const gaming = Array.from({ length: 10 }, () => video({ categoryId: '20' }))
    const mixed = ['10', '27', '28', '25'].map((categoryId) => video({ categoryId }))
    const out = rec.rank([...gaming, ...mixed], ctx({ profile }), { limit: 8 })
    expect(out.filter((r) => r.video.categoryId === '20').length).toBeLessThanOrEqual(4)
    expect(new Set(out.map((r) => r.video.categoryId)).size).toBeGreaterThanOrEqual(5)
  })

  it('works for a brand-new user (freshness + popularity only)', () => {
    const old = video({ publishedAt: new Date(NOW - 400 * 86_400_000).toISOString(), viewCount: 100 })
    const hot = video({ viewCount: 5_000_000 })
    expect(rec.rank([old, hot], ctx(), { limit: 2 })[0]!.video.id).toBe(hot.id)
  })

  it('boosts subscribed channels', () => {
    const sub = video({ title: 'From my sub', viewCount: 10 })
    const pop = video({ title: 'Popular', viewCount: 50_000_000 })
    const out = rec.rank([pop, sub], ctx({ subscribedChannelIds: new Set([sub.channelId]) }), { limit: 2 })
    expect(out[0]!.video.id).toBe(sub.id)
  })
})
