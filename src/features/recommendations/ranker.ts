import type { Video } from '@/types/youtube'
import { BONUSES, DIVERSITY, FRESHNESS_HALF_LIFE_DAYS, PENALTIES, RANK_WEIGHTS } from './config'
import type { RecommendationProfile } from './profile'
import { extractKeywords, jaccard } from './text'

/** A video the user showed strong interest in; used for "more like this" similarity. */
export interface SeedVideo {
  videoId: string
  title?: string
  channelId: string | null
  categoryId: string | null
  keywords: string[]
  /** 0..1 strength of the interest. */
  strength: number
}

export interface RankingContext {
  profile: RecommendationProfile
  /** videoId ??furthest percentage watched (0??00). */
  watched: ReadonlyMap<string, number>
  seeds: readonly SeedVideo[]
  recentlyShown: ReadonlySet<string>
  subscribedChannelIds: ReadonlySet<string>
  /** Never recommend these (e.g. the video currently playing). */
  excludeIds?: ReadonlySet<string>
  now?: number
}

export interface RankedVideo {
  video: Video
  score: number
  /** Short machine-readable tags explaining the strongest signal, e.g. for UI hints. */
  reasons: string[]
}

export interface RankOptions {
  limit: number
}

/** Swap this interface's implementation to plug in an ML model later. */
export interface Recommender {
  rank(candidates: readonly Video[], ctx: RankingContext, opts: RankOptions): RankedVideo[]
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const maxOf = (m: Record<string, number>) => Math.max(0, ...Object.values(m))

interface Scored extends RankedVideo {
  category: string
  channel: string
}

export class RuleBasedRecommender implements Recommender {
  rank(candidates: readonly Video[], ctx: RankingContext, { limit }: RankOptions): RankedVideo[] {
    const now = ctx.now ?? Date.now()
    const maxCat = maxOf(ctx.profile.category_scores)
    const maxChan = maxOf(ctx.profile.channel_scores)
    const maxKw = maxOf(ctx.profile.keyword_scores)

    const seen = new Set<string>()
    const scored: Scored[] = []
    for (const v of candidates) {
      if (seen.has(v.id) || ctx.excludeIds?.has(v.id) || !v.embeddable) continue
      seen.add(v.id)
      scored.push(this.score(v, ctx, { now, maxCat, maxChan, maxKw }))
    }
    return this.diversify(scored, limit)
  }

  private score(v: Video, ctx: RankingContext, m: { now: number; maxCat: number; maxChan: number; maxKw: number }): Scored {
    const category = v.categoryId ?? ''
    const catScore = category && m.maxCat > 0 ? clamp01((ctx.profile.category_scores[category] ?? 0) / m.maxCat) : 0
    const subscribed = ctx.subscribedChannelIds.has(v.channelId)
    const chanScore = Math.max(m.maxChan > 0 ? clamp01((ctx.profile.channel_scores[v.channelId] ?? 0) / m.maxChan) : 0, subscribed ? 0.8 : 0)

    const kws = extractKeywords(v.title, v.tags)
    const kwHits = kws.map((k) => ctx.profile.keyword_scores[k] ?? 0).filter((s) => s > 0).sort((a, b) => b - a)
    const kwScore = m.maxKw > 0 && kwHits.length ? clamp01(kwHits.slice(0, 3).reduce((a, b) => a + b, 0) / (2 * m.maxKw)) : 0

    let simScore = 0
    for (const seed of ctx.seeds) {
      if (seed.videoId === v.id) continue
      const sim = (seed.channelId === v.channelId ? 0.5 : 0) + (seed.categoryId && seed.categoryId === category ? 0.3 : 0) + 0.5 * jaccard(seed.keywords, kws)
      simScore = Math.max(simScore, clamp01(sim) * seed.strength)
    }

    const ageDays = Math.max(0, (m.now - Date.parse(v.publishedAt || '0')) / 86_400_000)
    const freshness = v.publishedAt ? 0.5 ** (ageDays / FRESHNESS_HALF_LIFE_DAYS) : 0
    const popularity = clamp01(Math.log10((v.viewCount ?? 0) + 1) / 9)

    let score =
      RANK_WEIGHTS.categoryMatch * catScore +
      RANK_WEIGHTS.channelMatch * chanScore +
      RANK_WEIGHTS.keywordMatch * kwScore +
      RANK_WEIGHTS.watchSimilarity * simScore +
      RANK_WEIGHTS.freshness * freshness +
      RANK_WEIGHTS.popularity * popularity

    const reasons: string[] = []
    if (chanScore >= 0.8) reasons.push(subscribed ? 'subscribed-channel' : 'favorite-channel')
    if (catScore >= 0.6) reasons.push('favorite-category')
    if (kwScore >= 0.4) reasons.push('matching-keywords')
    if (simScore >= 0.3) reasons.push('similar-to-watched')

    // Bonuses: exploration keeps the feed from collapsing into a bubble.
    if (category && catScore === 0 && m.maxCat > 0) {
      score += BONUSES.newTopic
      reasons.push('new-topic')
    }
    if (!subscribed && m.maxChan > 0 && !(v.channelId in ctx.profile.channel_scores)) {
      score += BONUSES.newChannel
      reasons.push('new-channel')
    }
    if (catScore > 0.7 && kwScore > 0.5) {
      score += BONUSES.strongInterestMatch
      reasons.push('strong-match')
    }

    // Penalties
    const pct = ctx.watched.get(v.id)
    if (pct !== undefined) {
      score -= PENALTIES.alreadyWatched * (pct >= 80 ? 1 : 0.4 + pct / 200)
      reasons.push('already-watched')
    }
    if (ctx.recentlyShown.has(v.id)) score -= PENALTIES.recentlyShown

    return { video: v, score, reasons, category, channel: v.channelId }
  }

  /** Greedy re-rank: each pick makes more of the same channel/category less attractive. */
  private diversify(scored: Scored[], limit: number): RankedVideo[] {
    const pool = [...scored].sort((a, b) => b.score - a.score)
    const picked: Scored[] = []
    const perChannel = new Map<string, number>()
    const perCategory = new Map<string, number>()
    const categoryCap = Math.max(2, Math.ceil(limit * DIVERSITY.maxCategoryShare))

    // Pass 1 enforces both caps; if the pool is too homogeneous to fill the feed we relax the
    // category cap first, then the channel cap, so the feed is never left short.
    const passes = [
      { category: true, channel: true },
      { category: false, channel: true },
      { category: false, channel: false },
    ]
    for (const pass of passes) {
      while (picked.length < limit && pool.length) {
        let bestIdx = -1
        let best = -Infinity
        for (let i = 0; i < pool.length; i++) {
          const c = pool[i]!
          const chCount = perChannel.get(c.channel) ?? 0
          const catCount = perCategory.get(c.category) ?? 0
          if (pass.channel && chCount >= DIVERSITY.maxPerChannel) continue
          if (pass.category && c.category && catCount >= categoryCap) continue
          const adjusted = c.score - PENALTIES.sameChannelRepeated * chCount - PENALTIES.sameCategoryRepeated * catCount
          if (adjusted > best) {
            best = adjusted
            bestIdx = i
          }
        }
        if (bestIdx < 0) break
        const [chosen] = pool.splice(bestIdx, 1)
        picked.push(chosen!)
        perChannel.set(chosen!.channel, (perChannel.get(chosen!.channel) ?? 0) + 1)
        perCategory.set(chosen!.category, (perCategory.get(chosen!.category) ?? 0) + 1)
      }
    }
    return picked.map(({ video, score, reasons }) => ({ video, score, reasons }))
  }
}

export const recommender: Recommender = new RuleBasedRecommender()
