import { useEffect, useRef, useState } from 'react'

/** Reveals an already-loaded list in pages as the sentinel scrolls into view. `resetKey` restarts at the first page. */
export function useClientPaged<T>(items: readonly T[], resetKey: string, pageSize = 30) {
  const [state, setState] = useState({ key: resetKey, count: pageSize })
  const count = state.key === resetKey ? state.count : pageSize
  const sentinel = useRef<HTMLDivElement>(null)
  const hasMore = count < items.length

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setState((s) => ({ key: resetKey, count: (s.key === resetKey ? s.count : pageSize) + pageSize }))
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, count, resetKey, pageSize])

  return { visible: items.slice(0, count), hasMore, sentinel }
}
