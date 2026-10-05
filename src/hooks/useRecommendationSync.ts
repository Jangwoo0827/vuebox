import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { signalQueue } from '@/features/recommendations/signalQueue'
import { qk } from '@/lib/queryKeys'
import { useAuth } from './useAuth'
import { useSettings } from './useSettings'

/** Binds the signal queue to the current user and their "Personalization" setting. */
export function useRecommendationSync() {
  const { userId } = useAuth()
  const { settings, isLoading } = useSettings()
  const qc = useQueryClient()
  const enabled = settings.personalization && !isLoading

  useEffect(() => {
    signalQueue.configure(userId, enabled, () => {
      if (userId) void qc.invalidateQueries({ queryKey: qk.recProfile(userId) })
    })
    return () => signalQueue.configure(null, false)
  }, [userId, enabled, qc])
}
