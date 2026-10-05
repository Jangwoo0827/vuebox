import { Maximize, Pause, Play, RectangleHorizontal, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatDuration } from '@/utils/format'
import type { PlayerApi } from './useYouTubePlayer'
import { PlayerState } from './youtubeApi'

interface Props {
  api: PlayerApi
  state: number
  rate: number
  ready: boolean
  theater: boolean
  onToggleTheater: () => void
}

/** Page-level controls rendered *below* the player (nothing overlays the YouTube iframe). */
export function PlayerControls({ api, state, rate, ready, theater, onToggleTheater }: Props) {
  const [time, setTime] = useState({ current: 0, duration: 0 })
  const [volume, setVolume] = useState(100)
  const [muted, setMuted] = useState(false)
  const [seeking, setSeeking] = useState<number | null>(null)

  useEffect(() => {
    if (!ready) return
    const tick = () => {
      setTime({ current: api.getCurrentTime(), duration: api.getDuration() })
      setVolume(api.getVolume())
      setMuted(api.isMuted())
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [api, ready])

  const playing = state === PlayerState.PLAYING || state === PlayerState.BUFFERING
  const shown = seeking ?? time.current
  const rates = api.getRates()

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-surface px-2 py-1.5" role="group" aria-label="재생 컨트롤">
      <button type="button" className="icon-btn" disabled={!ready} onClick={api.togglePlay} aria-label={playing ? '일시정지' : '재생'}>
        {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
      </button>
      <button type="button" className="icon-btn" disabled={!ready} onClick={() => api.seekBy(-10)} aria-label="10초 뒤로">
        <RotateCcw className="size-5" aria-hidden />
      </button>
      <button type="button" className="icon-btn" disabled={!ready} onClick={() => api.seekBy(10)} aria-label="10초 앞으로">
        <RotateCw className="size-5" aria-hidden />
      </button>

      <span className="w-[5.5rem] shrink-0 text-center text-xs tabular-nums text-text-secondary" aria-hidden>
        {formatDuration(shown)} / {formatDuration(time.duration)}
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.floor(time.duration))}
        step={1}
        value={Math.min(Math.floor(shown), Math.max(1, Math.floor(time.duration)))}
        disabled={!ready || time.duration === 0}
        aria-label="재생 위치"
        aria-valuetext={`${formatDuration(shown)} / ${formatDuration(time.duration)}`}
        onChange={(e) => setSeeking(Number(e.target.value))}
        onPointerUp={() => {
          if (seeking !== null) api.seekTo(seeking)
          setSeeking(null)
        }}
        onKeyUp={() => {
          if (seeking !== null) api.seekTo(seeking)
          setSeeking(null)
        }}
        className="h-2 min-w-24 flex-1 accent-[var(--accent)]"
      />

      <button type="button" className="icon-btn" disabled={!ready} onClick={api.toggleMute} aria-label={muted ? '음소거 해제' : '음소거'}>
        {muted || volume === 0 ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
      </button>
      <input type="range" min={0} max={100} value={muted ? 0 : volume} disabled={!ready} aria-label="볼륨" onChange={(e) => api.setVolume(Number(e.target.value))} className="hidden h-2 w-20 accent-[var(--accent)] sm:block" />

      <label className="flex items-center gap-1 text-xs text-text-secondary">
        <span className="sr-only sm:not-sr-only">속도</span>
        <select value={rate} disabled={!ready} onChange={(e) => api.setPlaybackRate(Number(e.target.value))} className="min-h-9 rounded-lg border border-border bg-surface-2 px-2 text-sm text-text" aria-label="재생 속도">
          {rates.map((r) => (
            <option key={r} value={r}>
              {r === 1 ? '보통' : `${r}x`}
            </option>
          ))}
        </select>
      </label>

      <button type="button" className={`icon-btn hidden lg:inline-flex ${theater ? 'btn-active' : ''}`} onClick={onToggleTheater} aria-pressed={theater} aria-label="극장 모드" title="극장 모드 (T)">
        <RectangleHorizontal className="size-5" aria-hidden />
      </button>
      <button type="button" className="icon-btn" disabled={!ready} onClick={api.requestFullscreen} aria-label="전체 화면" title="전체 화면 (F)">
        <Maximize className="size-5" aria-hidden />
      </button>
    </div>
  )
}
