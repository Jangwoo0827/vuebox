import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/queryKeys'
import { getProfile } from '@/services/profileService'
import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const ready = useAuthStore((s) => s.ready)
  return { user, userId: user?.id ?? null, ready, isSignedIn: !!user }
}

export function useProfile() {
  const { userId } = useAuth()
  return useQuery({
    queryKey: qk.profile(userId ?? 'anon'),
    queryFn: () => getProfile(userId!),
    enabled: !!userId,
    staleTime: 10 * 60_000,
  })
}
