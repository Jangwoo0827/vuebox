import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/ui/StateViews'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function NotFoundPage() {
  usePageTitle('페이지를 찾을 수 없습니다')
  return (
    <EmptyState
      title="페이지를 찾을 수 없습니다"
      description="주소가 잘못되었거나 이동된 페이지입니다."
      action={
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      }
    />
  )
}
