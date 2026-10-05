/** YouTube's standard video category ids → display names (used for stats and labels). */
export const CATEGORY_NAMES: Record<string, string> = {
  '1': 'Film & Animation',
  '2': 'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Technology',
  '29': 'Nonprofits & Activism',
}

export const categoryName = (id: string) => CATEGORY_NAMES[id] ?? 'Other'

export type DiscoverSource = { kind: 'chart'; categoryId: string } | { kind: 'search'; q: string }

export interface DiscoverCategory {
  slug: string
  label: string
  source: DiscoverSource
}

/**
 * YouTube has no category for Coding or Science alone, so those use a search query (100 quota units,
 * cached server-side). Everything else uses the mostPopular chart for the category (1 unit).
 */
export const DISCOVER_CATEGORIES: DiscoverCategory[] = [
  { slug: 'gaming', label: 'Gaming', source: { kind: 'chart', categoryId: '20' } },
  { slug: 'music', label: 'Music', source: { kind: 'chart', categoryId: '10' } },
  { slug: 'technology', label: 'Technology', source: { kind: 'chart', categoryId: '28' } },
  { slug: 'science', label: 'Science', source: { kind: 'search', q: 'science explained' } },
  { slug: 'education', label: 'Education', source: { kind: 'chart', categoryId: '27' } },
  { slug: 'coding', label: 'Coding', source: { kind: 'search', q: 'programming tutorial' } },
  { slug: 'sports', label: 'Sports', source: { kind: 'chart', categoryId: '17' } },
  { slug: 'travel', label: 'Travel', source: { kind: 'chart', categoryId: '19' } },
  { slug: 'entertainment', label: 'Entertainment', source: { kind: 'chart', categoryId: '24' } },
  { slug: 'news', label: 'News', source: { kind: 'chart', categoryId: '25' } },
  { slug: 'animation', label: 'Animation', source: { kind: 'chart', categoryId: '1' } },
  { slug: 'other', label: 'Other', source: { kind: 'chart', categoryId: '22' } },
]

/** Regions offered for Trending / settings. */
export const REGIONS = [
  { code: 'KR', label: '대한민국' },
  { code: 'US', label: 'United States' },
  { code: 'JP', label: '日本' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
] as const

export const DEFAULT_REGION = 'KR'
