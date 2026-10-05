import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_REGION } from '@/constants/categories'
import { qk } from '@/lib/queryKeys'
import { getSettings, updateSettings } from '@/services/profileService'
import { useUiStore } from '@/stores/uiStore'
import { toast } from '@/stores/toastStore'
import type { UserSettings } from '@/types/db'
import { useAuth } from './useAuth'

export type SettingsValues = Omit<UserSettings, 'user_id'>

export const DEFAULT_SETTINGS: SettingsValues = {
  theme: 'dark',
  autoplay: true,
  save_watch_history: true,
  save_search_history: true,
  personalization: true,
  notifications_enabled: true,
  region: DEFAULT_REGION,
  default_playback_rate: 1,
}

/** Account settings from Supabase; signed-out visitors get defaults (+ their device's region/theme). */
export function useSettings() {
  const { userId } = useAuth()
  const qc = useQueryClient()
  const guestRegion = useUiStore((s) => s.guestRegion)

  const query = useQuery({
    queryKey: qk.settings(userId ?? 'anon'),
    queryFn: () => getSettings(userId!),
    enabled: !!userId,
    staleTime: 10 * 60_000,
  })

  const mutation = useMutation({
    mutationFn: (patch: Partial<SettingsValues>) => updateSettings(userId!, patch),
    onMutate: async (patch) => {
      const key = qk.settings(userId!)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<UserSettings | null>(key)
      if (prev) qc.setQueryData(key, { ...prev, ...patch })
      return { prev }
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.settings(userId!), ctx.prev)
      toast.error('설정을 저장하지 못했습니다.')
    },
  })

  const settings: SettingsValues = userId
    ? { ...DEFAULT_SETTINGS, ...(query.data ?? {}) }
    : { ...DEFAULT_SETTINGS, region: guestRegion }

  return {
    settings,
    isLoading: !!userId && query.isLoading,
    update: (patch: Partial<SettingsValues>) => {
      if (userId) return mutation.mutateAsync(patch)
      if (patch.region) useUiStore.getState().setGuestRegion(patch.region)
      return Promise.resolve(undefined)
    },
  }
}
