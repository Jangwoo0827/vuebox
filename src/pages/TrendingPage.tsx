import { InfiniteVideoGrid } from '@/components/video/InfiniteVideoGrid'
import { PageHeader } from '@/components/ui/Section'
import { REGIONS } from '@/constants/categories'
import { useInfiniteList } from '@/hooks/useInfiniteList'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSettings } from '@/hooks/useSettings'
import { qk } from '@/lib/queryKeys'
import { getTrendingVideos } from '@/services/youtubeService'

export default function TrendingPage() {
  usePageTitle('Trending', '지역별 인기 급상승 영상')
  const { settings, update } = useSettings()
  const region = settings.region

  const list = useInfiniteList(qk.trending(region, 'page'), (pageToken) => getTrendingVideos({ regionCode: region, pageToken, maxResults: 24 }))
  const unavailable = list.data?.pages[0]?.unavailable

  return (
    <div>
      <PageHeader
        title="Trending"
        description="YouTube 지역별 인기 급상승 영상"
        actions={
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            지역
            <select className="input !min-h-10 !w-auto" value={region} onChange={(e) => void update({ region: e.target.value })} aria-label="지역 선택">
              {REGIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} · {r.label}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <InfiniteVideoGrid list={list} emptyTitle={unavailable ? '이 지역은 인기 영상을 제공하지 않습니다' : '표시할 영상이 없습니다'} emptyDescription={unavailable ? '다른 지역을 선택해 보세요.' : undefined} />
    </div>
  )
}
