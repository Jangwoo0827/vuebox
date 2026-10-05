import { ExternalLink } from 'lucide-react'
import { useEffect, useRef, type RefObject } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { type PlayerApi, type PlayerEvents, useYouTubePlayer } from './useYouTubePlayer'
import { PLAYER_ERROR_MESSAGES, youtubeWatchUrl } from './youtubeApi'
import { PlayerControls } from './PlayerControls'

interface Props extends PlayerEvents {
  videoId: string
  startSeconds: number
  autoplay: boolean
  playbackRate: number
  /** Hold off creating the player until the resume position is known. */
  enabled: boolean
  theater: boolean
  onToggleTheater: () => void
  apiRef: RefObject<PlayerApi | null>
  /** `vertical` renders a 9:16 box (Shorts); the default is 16:9. */
  vertical?: boolean
  hideControls?: boolean
  /** Edge-to-edge player (landscape phone): no rounded corners and no control strip below. */
  immersive?: boolean
}

/** Per-device preference (Settings → Playback). Defaults to the privacy-enhanced embed. */
export const usePrivacyPlayer = () => useUiStore((s) => s.privacyPlayer)

/** Responsive (aspect-ratio based) box that hosts the official YouTube player and its page-level controls. */
export function PlayerContainer({ videoId, startSeconds, autoplay, playbackRate, enabled, theater, onToggleTheater, apiRef, vertical, hideControls, immersive, ...events }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const privacyMode = usePrivacyPlayer()
  const { api, ready, state, error, rate } = useYouTubePlayer(hostRef, { videoId, startSeconds, autoplay, playbackRate, enabled, privacyMode, ...events })
  // Expose the imperative API to the page (shortcuts, notes, tracking). Not cleared on unmount:
  // the page's own cleanup effects may still need to read the last position.
  useEffect(() => {
    apiRef.current = api
  }, [api, apiRef])

  return (
    <div>
      <div className={`player-box ${vertical ? 'player-box-vertical' : ''} ${immersive ? '!rounded-none' : ''}`}>
        <div ref={hostRef} className="absolute inset-0" />
        {!ready && !error && <div className="skeleton absolute inset-0 !rounded-none" aria-hidden />}
        {error && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-2 p-6 text-center">
            <p className="max-w-md text-sm">{PLAYER_ERROR_MESSAGES[error]}</p>
            <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              <ExternalLink className="size-4" aria-hidden /> YouTube에서 보기
            </a>
          </div>
        )}
      </div>
      {!hideControls && !immersive && <PlayerControls api={api} state={state} rate={rate} ready={ready} theater={theater} onToggleTheater={onToggleTheater} />}
    </div>
  )
}
