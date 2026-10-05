import { useLocation } from 'react-router-dom'
import { useUiStore } from '@/stores/uiStore'

/**
 * Desktop sidebar mode. The Watch page always uses the slim rail so the player gets the room
 * (`forced`); everywhere else it follows the user's collapse toggle.
 */
export function useSidebarMode(): { mode: 'expanded' | 'rail'; forced: boolean } {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const forced = useLocation().pathname.startsWith('/watch/')
  return { mode: collapsed || forced ? 'rail' : 'expanded', forced }
}
