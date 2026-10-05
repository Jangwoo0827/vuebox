import { useEffect, type RefObject } from 'react'
import type { PlayerApi } from './useYouTubePlayer'

const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'
const ACTIVATABLE = 'button, a[href], summary, [role="button"], [role="menuitem"], [role="option"], [role="tab"]'

/**
 * Keyboard controls while focus is on the page (the iframe handles its own keys when it has focus):
 * Space play/pause · ←/→ ∓5s · ↑/↓ volume · M mute · F fullscreen · T theater.
 * Never fires while typing, with modifier keys, or when Space/Enter would activate a focused control.
 * (Picture-in-Picture is not offered: the YouTube iframe is cross-origin, so pages cannot trigger it.)
 */
export function usePlayerShortcuts(apiRef: RefObject<PlayerApi | null>, onToggleTheater?: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const api = apiRef.current
      if (!api || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest(TYPING) || document.querySelector('[role="dialog"][aria-modal="true"]')) return

      const key = e.key.toLowerCase()
      switch (key) {
        case ' ':
        case 'spacebar':
          if (target?.closest(ACTIVATABLE)) return
          e.preventDefault()
          api.togglePlay()
          break
        case 'arrowleft':
          e.preventDefault()
          api.seekBy(-5)
          break
        case 'arrowright':
          e.preventDefault()
          api.seekBy(5)
          break
        case 'arrowup':
          e.preventDefault()
          api.setVolume(api.getVolume() + 5)
          break
        case 'arrowdown':
          e.preventDefault()
          api.setVolume(api.getVolume() - 5)
          break
        case 'm':
          api.toggleMute()
          break
        case 'f':
          api.requestFullscreen()
          break
        case 't':
          onToggleTheater?.()
          break
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [apiRef, onToggleTheater])
}
