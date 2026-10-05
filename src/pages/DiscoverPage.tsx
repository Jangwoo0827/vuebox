import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { InfiniteVideoGrid } from '@/components/video/InfiniteVideoGrid'
import { PageHeader } from '@/components/ui/Section'
import { DISCOVER_CATEGORIES, type DiscoverCategory } from '@/constants/categories'
import { useRecommendationContext } from '@/features/recommendations/useRecommendationContext'
import { useInfiniteList } from '@/hooks/useInfiniteList'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSettings } from '@/hooks/useSettings'
import { qk } from '@/lib/queryKeys'
import { getCategoryVideos, searchVideos } from '@/services/youtubeService'
import type { Page, Video } from '@/types/youtube'

/** Categories the user watches most are listed first. */
function useOrderedCategories(): DiscoverCategory[] {
  const { profile, personalized } = useRecommendationContext()
  return useMemo(() => {
    if (!personalized) return DISCOVER_CATEGORIES
    const score = (c: DiscoverCategory) => (c.source.kind === 'chart' ? (profile.category_scores[c.source.categoryId] ?? 0) : 0)
    return [...DISCOVER_CATEGORIES].sort((a, b) => score(b) - score(a))
  }, [profile, personalized])
}

export default function DiscoverPage() {
  const [params, setParams] = useSearchParams()
  const categories = useOrderedCategories()
  const current = categories.find((c) => c.slug === params.get('c')) ?? categories[0]!
  usePageTitle(`Discover · ${current.label}`, `${current.label} 카테고리의 영상을 둘러보세요`)
  const { settings } = useSettings()
  const region = settings.region

  const list = useInfiniteList<Page<Video>>(qk.categoryVideos(region, current.slug), (pageToken) =>
    current.source.kind === 'chart'
      ? getCategoryVideos({ regionCode: region, categoryId: current.source.categoryId, pageToken, maxResults: 24 })
      : searchVideos({ q: current.source.q, regionCode: region, pageToken }),
  )

  return (
    <div>
      <PageHeader title="Discover" description="관심 있는 카테고리를 둘러보세요" />
      <div className="scroll-x mb-6 -mx-1 px-1" role="group" aria-label="카테고리">
        {categories.map((c) => (
          <button key={c.slug} type="button" className="chip" aria-pressed={c.slug === current.slug} onClick={() => setParams({ c: c.slug }, { replace: true })}>
            {c.label}
          </button>
        ))}
      </div>
      <InfiniteVideoGrid list={list} emptyTitle="이 카테고리의 인기 영상이 없습니다" emptyDescription="다른 카테고리를 선택해 보세요." />
    </div>
  )
}
