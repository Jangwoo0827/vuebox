import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { classifyPlayerError, loadYouTubeApi, PlayerState, type PlayerErrorKind } from './youtubeApi'

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void
  }
}

export interface PlayerEvents {
  onReady?: () => void
  onStateChange?: (state: number) => void
  onError?: (kind: PlayerErrorKind) => void
}

export interface PlayerApi {
  play: () => void
  pause: () => void
  togglePlay: () => void
  seekTo: (seconds: number) => void
  seekBy: (delta: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  setPlaybackRate: (r: number) => void
  requestFullscreen: () => void
  getCurrentTime: () => number
  getDuration: () => number
  getVolume: () => number
  isMuted: () => boolean
  getState: () => number
  getRates: () => number[]
}

interface Options extends PlayerEvents {
  videoId: string
  /** Where to start (seconds). Used when the video loads. */
  startSeconds?: number
  autoplay: boolean
  playbackRate?: number
  /** Wait to create the player until this is true (e.g. until resume position is known). */
  enabled?: boolean
}

/**
 * Wraps the official YouTube IFrame Player. The iframe itself is never touched; we only call its
 * public API. Mount it per video (key by videoId) so resume position and tracking start clean.
 */
export function useYouTubePlayer(containerRef: RefObject<HTMLDivElement | null>, opts: Options) {
  const playerRef = useRef<YT.Player | null>(null)
  const readyRef = useRef(false)
  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts // event callbacks always see the latest props
  })

  const [ready, setReady] = useState(false)
  const [state, setState] = useState<number>(PlayerState.UNSTARTED)
  const [error, setError] = useState<PlayerErrorKind | null>(null)
  const [rate, setRate] = useState(1)

  const enabled = opts.enabled !== false

  // Create the player once.
  useEffect(() => {
    const container = containerRef.current
    if (!enabled || !container) return
    let cancelled = false
    const host = document.createElement('div')
    container.appendChild(host)

    loadYouTubeApi()
      .then(() => {
        if (cancelled) return
        const o = optsRef.current
        playerRef.current = new YT.Player(host, {
          videoId: o.videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            enablejsapi: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
            autoplay: o.autoplay ? 1 : 0,
            start: Math.floor(o.startSeconds ?? 0),
          },
          events: {
            onReady: (e) => {
              readyRef.current = true
              const wanted = optsRef.current.playbackRate
              if (wanted && wanted !== 1) e.target.setPlaybackRate(wanted)
              setReady(true)
              optsRef.current.onReady?.()
            },
            onStateChange: (e) => {
              setState(e.data)
              optsRef.current.onStateChange?.(e.data)
            },
            onPlaybackRateChange: (e) => setRate(e.data),
            onError: (e) => {
              const kind = classifyPlayerError(e.data)
              setError(kind)
              optsRef.current.onError?.(kind)
            },
          },
        })
      })
      .catch(() => {
        if (cancelled) return
        setError('script')
        optsRef.current.onError?.('script')
      })

    return () => {
      cancelled = true
      readyRef.current = false
      setReady(false)
      try {
        playerRef.current?.destroy()
      } catch {
        /* player already gone */
      }
      playerRef.current = null
      host.remove()
    }
    // One player per mount: callers key the component by videoId, so the options are read once at creation.
  }, [enabled, containerRef])

  const api = useMemo<PlayerApi>(() => {
    const p = () => (readyRef.current ? playerRef.current : null)
    return {
      play: () => p()?.playVideo(),
      pause: () => p()?.pauseVideo(),
      togglePlay: () => {
        const pl = p()
        if (!pl) return
        if (pl.getPlayerState() === PlayerState.PLAYING) pl.pauseVideo()
        else pl.playVideo()
      },
      seekTo: (s) => p()?.seekTo(Math.max(0, s), true),
      seekBy: (d) => {
        const pl = p()
        if (pl) pl.seekTo(Math.max(0, pl.getCurrentTime() + d), true)
      },
      setVolume: (v) => {
        const pl = p()
        if (!pl) return
        pl.setVolume(Math.min(100, Math.max(0, Math.round(v))))
        if (v > 0 && pl.isMuted()) pl.unMute()
      },
      toggleMute: () => {
        const pl = p()
        if (!pl) return
        if (pl.isMuted()) pl.unMute()
        else pl.mute()
      },
      setPlaybackRate: (r) => p()?.setPlaybackRate(r),
      requestFullscreen: () => {
        const el = p()?.getIframe()
        if (el?.requestFullscreen) void el.requestFullscreen().catch(() => undefined)
      },
      getCurrentTime: () => p()?.getCurrentTime() ?? 0,
      getDuration: () => p()?.getDuration() ?? 0,
      getVolume: () => p()?.getVolume() ?? 100,
      isMuted: () => p()?.isMuted() ?? false,
      getState: () => p()?.getPlayerState() ?? PlayerState.UNSTARTED,
      getRates: () => p()?.getAvailablePlaybackRates() ?? [0.5, 1, 1.5, 2],
    }
  }, [])

  return { api, ready, state, error, rate }
}
