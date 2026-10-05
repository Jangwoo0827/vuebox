import { useLocation } from 'react-router-dom'
import { useMediaQuery } from './useMediaQuery'

/**
 * Phone held sideways on the Watch page: hide the app chrome and let the player fill the screen.
 * (Browsers only allow real fullscreen after a tap, so this is a layout, not the Fullscreen API.)
 * Rotating back to portrait brings the top bar and navigation back.
 */
export function useImmersiveLandscape(): boolean {
  const landscapePhone = useMediaQuery('(orientation: landscape) and (max-height: 500px)')
  return landscapePhone && useLocation().pathname.startsWith('/watch/')
}
