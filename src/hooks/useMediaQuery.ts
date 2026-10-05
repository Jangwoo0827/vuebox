import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      // Some mobile browsers are slow or inconsistent about firing media-query change events on
      // rotation; resize/orientationchange re-check the (cheap) snapshot as a safety net.
      window.addEventListener('resize', cb)
      window.addEventListener('orientationchange', cb)
      return () => {
        mq.removeEventListener('change', cb)
        window.removeEventListener('resize', cb)
        window.removeEventListener('orientationchange', cb)
      }
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
