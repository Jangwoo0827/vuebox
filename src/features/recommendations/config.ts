/** Tunable knobs for the rule-based recommender. Change numbers here; nothing else needs to move. */
export const RANK_WEIGHTS = {
  categoryMatch: 0.25,
  channelMatch: 0.2,
  keywordMatch: 0.2,
  watchSimilarity: 0.2,
  freshness: 0.1,
  popularity: 0.05,
} as const

export const PENALTIES = {
  /** Scaled by how much of the video was already watched (completed ⇒ full penalty). */
  alreadyWatched: 0.6,
  recentlyShown: 0.25,
  /** Applied per earlier pick from the same channel / category while diversifying. */
  sameChannelRepeated: 0.15,
  sameCategoryRepeated: 0.06,
} as const

export const BONUSES = {
  newTopic: 0.08,
  newChannel: 0.05,
  strongInterestMatch: 0.1,
} as const

export const DIVERSITY = {
  maxPerChannel: 2,
  /** No single category may take more than this share of a feed. */
  maxCategoryShare: 0.4,
} as const

/** Interest gained from watching, by furthest point reached. A bare click earns almost nothing. */
export const WATCH_TIERS = [
  { minPercent: 95, weight: 3 },
  { minPercent: 80, weight: 2 },
  { minPercent: 50, weight: 1 },
  { minPercent: 25, weight: 0.5 },
  { minPercent: 10, weight: 0.2 },
  { minPercent: 0, weight: 0.05 },
] as const

export const ACTION_WEIGHTS = {
  like: 2,
  favorite: 2.5,
  watchLater: 1,
  playlistAdd: 1.5,
  subscribe: 3,
  search: 0.5,
} as const

export const PROFILE = {
  /** Interest halves every N days without reinforcement. */
  halfLifeDays: 30,
  pruneBelow: 0.05,
  maxCategories: 30,
  maxKeywords: 150,
  maxChannels: 80,
  preferredCategories: 5,
  preferredKeywords: 15,
  preferredChannels: 10,
  keywordsPerSignal: 8,
  /** Fraction of a signal's weight given to each keyword (keywords are weaker evidence than category/channel). */
  keywordShare: 0.6,
  flushIntervalMs: 60_000,
} as const

export const FRESHNESS_HALF_LIFE_DAYS = 14
export const RECENTLY_SHOWN_HOURS = 24
export const SEED_COUNT = 20
