import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingState } from '@/components/ui/StateViews'
import { useAuth } from '@/hooks/useAuth'

/** Routes inside need an account; signed-out visitors are sent to /login and returned afterwards. */
export function RequireAuth() {
  const { isSignedIn, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <LoadingState />
  if (!isSignedIn) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}
