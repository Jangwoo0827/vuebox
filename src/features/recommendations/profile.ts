import type { RecommendationProfileRow, ScoreMap } from '@/types/db'
import type { Video } from '@/types/youtube'
import { ACTION_WEIGHTS, PROFILE, WATCH_TIERS } from './config'
import { extractKeywords, tokenize } from './text'

export type RecommendationProfile = Pick<
  RecommendationProfileRow,
  'preferred_categories' | 'preferred_keywords' | 'preferred_channels' | 'category_scores' | 'keyword_scores' | 'channel_scores' | 'last_updated_at'
>

/** One unit of evidence about what the user is interested in. */
export interface InterestSignal {
  weight: number
  categoryId?: string | null
  channelId?: string | null
  keywords?: string[]
}

export const emptyProfile = (now = new Date()): RecommendationProfile => ({
  preferred_categories: [],
  preferred_keywords: [],
  preferred_channels: [],
  category_scores: {},
  keyword_scores: {},
  channel_scores: {},
  last_updated_at: now.toISOString(),
})

/** Interest weight for having watched up to `percent` of a video (see WATCH_TIERS). */
export function watchInterestWeight(percent: number): number {
  return WATCH_TIERS.find((t) => percent >= t.minPercent)?.weight ?? 0
}

/** Extra interest to credit when progress moves from `prev` to `next` percent — never double counts. */
export const watchInterestDelta = (prevPercent: number, nextPercent: number) =>
  Math.max(0, watchInterestWeight(nextPercent) - watchInterestWeight(prevPercent))

export function signalFromVideo(video: Pick<Video, 'categoryId' | 'channelId' | 'title' | 'tags'>, weight: number): InterestSignal {
  return { weight, categoryId: video.categoryId, channelId: video.channelId, keywords: extractKeywords(video.title, video.tags, PROFILE.keywordsPerSignal) }
}

export const signalFromQuery = (query: string): InterestSignal => ({
  weight: ACTION_WEIGHTS.search,
  keywords: tokenize(query).slice(0, PROFILE.keywordsPerSignal),
})

const topKeys = (m: ScoreMap, n: number) =>
  Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)

const prune = (m: ScoreMap, max: number): ScoreMap => Object.fromEntries(topKeys(m, max).filter(([, v]) => v >= PROFILE.pruneBelow))

function decayed(m: ScoreMap, factor: number): ScoreMap {
  const out: ScoreMap = {}
  for (const [k, v] of Object.entries(m)) out[k] = v * factor
  return out
}

const round = (n: number) => Math.round(n * 1000) / 1000

/** Pure: returns a new profile with time decay applied and the signals folded in. */
export function applySignals(profile: RecommendationProfile, signals: InterestSignal[], now = new Date()): RecommendationProfile {
  const days = Math.max(0, (now.getTime() - new Date(profile.last_updated_at).getTime()) / 86_400_000)
  const factor = 0.5 ** (days / PROFILE.halfLifeDays)

  const categories = decayed(profile.category_scores, factor)
  const keywords = decayed(profile.keyword_scores, factor)
  const channels = decayed(profile.channel_scores, factor)

  for (const s of signals) {
    if (s.weight <= 0) continue
    if (s.categoryId) categories[s.categoryId] = (categories[s.categoryId] ?? 0) + s.weight
    if (s.channelId) channels[s.channelId] = (channels[s.channelId] ?? 0) + s.weight
    for (const kw of s.keywords ?? []) keywords[kw] = (keywords[kw] ?? 0) + s.weight * PROFILE.keywordShare
  }

  const category_scores = prune(categories, PROFILE.maxCategories)
  const keyword_scores = prune(keywords, PROFILE.maxKeywords)
  const channel_scores = prune(channels, PROFILE.maxChannels)
  const rounded = (m: ScoreMap) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, round(v)]))

  return {
    category_scores: rounded(category_scores),
    keyword_scores: rounded(keyword_scores),
    channel_scores: rounded(channel_scores),
    preferred_categories: topKeys(category_scores, PROFILE.preferredCategories).map(([k]) => k),
    preferred_keywords: topKeys(keyword_scores, PROFILE.preferredKeywords).map(([k]) => k),
    preferred_channels: topKeys(channel_scores, PROFILE.preferredChannels).map(([k]) => k),
    last_updated_at: now.toISOString(),
  }
}

export const hasSignal = (p: RecommendationProfile) =>
  Object.keys(p.category_scores).length + Object.keys(p.keyword_scores).length + Object.keys(p.channel_scores).length > 0
