import { Clock, Star, ThumbsUp } from 'lucide-react'
import { SavedVideosPage } from './SavedVideosPage'

export function WatchLaterPage() {
  return <SavedVideosPage table="watch_later" title="Watch Later" description="나중에 볼 영상" icon={<Clock className="size-6" />} emptyTitle="나중에 볼 영상이 없습니다." emptyDescription="영상 페이지의 Watch Later 버튼으로 저장해 두세요." />
}

export function FavoritesPage() {
  return <SavedVideosPage table="favorites" title="Favorites" description="즐겨찾기한 영상" icon={<Star className="size-6" />} emptyTitle="즐겨찾기한 영상이 없습니다." emptyDescription="마음에 드는 영상을 Favorite으로 표시해 보세요." />
}

export function LikedPage() {
  return <SavedVideosPage table="video_likes" title="Liked" description="좋아요한 영상 (VUEBOX 내부 좋아요이며 YouTube 좋아요와 별개입니다)" icon={<ThumbsUp className="size-6" />} emptyTitle="좋아요한 영상이 없습니다." emptyDescription="영상 페이지의 Like 버튼을 눌러보세요." />
}
