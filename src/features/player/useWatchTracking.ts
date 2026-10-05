import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { signalFromVideo, watchInterestDelta } from '@/features/recommendations/profile'
import { signalQueue } from '@/features/recommendations/signalQueue'
import { qk } from '@/lib/queryKeys'
import { saveProgress, toPercentage } from '@/services/historyService'
import type { WatchHistoryRow } from '@/types/db'
import type { Video } from '@/types/youtube'
import type { PlayerApi } from './useYouTubePlayer'
import { PlayerState } from './youtubeApi'

const SAVE_INTERVAL_MS = 15_000
const MIN_GAP_MS = 2_000

interface Options {
  video: Video | null
  apiRef: RefObject<PlayerApi | null>
  userId: string | null
  /** Settings → "History: ON/OFF". */
  saveHistory: boolean
  /** Existing history row, so watch time and credited interest continue instead of restarting. */
  existing: WatchHistoryRow | null | undefined
  /** Only start tracking once the existing row (if any) has loaded. */
  ready: boolean
}

/**
 * Persists watch progress without hammering Supabase:
 *  - first play and every pause/end save immediately,
 *  - while playing, at most once every 15 s,
 *  - tab hidden / navigating away saves the latest position.
 * Rows are upserted on (user_id, video_id) so one video is one history row.
 */
export function useWatchTracking({ video, apiRef, userId, saveHistory, existing, ready }: Options) {
  const qc = useQueryClient()

  const live = useRef({ video, userId, saveHistory, existing, ready })
  useEffect(() => {
    live.current = { video, userId, saveHistory, existing, ready }
  })

  const session = useRef({
    videoId: '',
    playingSince: 0, // ms timestamp while PLAYING, else 0
    watched: 0, // seconds accumulated this session
    baseWatched: 0,
    creditedPct: -1,
    lastSaveAt: 0,
    lastSavedProgress: -1,
    completed: false,
    startedAt: undefined as string | undefined,
    playLogged: false,
    hasRow: false, // a history row already holds a real position
    initialisedFor: '',
  })
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const chain = useRef<Promise<void>>(Promise.resolve())

  // (Re)initialise per video once the existing row is known.
  useEffect(() => {
    if (!video || !ready) return
    const s = session.current
    if (s.initialisedFor === video.id) return
    Object.assign(s, {
      videoId: video.id,
      initialisedFor: video.id,
      playingSince: 0,
      watched: 0,
      baseWatched: existing?.watched_seconds ?? 0,
      creditedPct: existing ? existing.watch_percentage : -1,
      lastSaveAt: 0,
      lastSavedProgress: -1,
      completed: existing?.completed ?? false,
      startedAt: existing ? undefined : new Date().toISOString(),
      playLogged: false,
      hasRow: !!existing,
    })
  }, [video, ready, existing])

  const flushWatchTime = () => {
    const s = session.current
    if (s.playingSince) {
      s.watched += (Date.now() - s.playingSince) / 1000
      s.playingSince = Date.now()
    }
  }

  const save = useCallback(
    (opts: { force?: boolean; ended?: boolean; video?: Video } = {}) => {
      const { userId: uid, saveHistory: persist } = live.current
      const v = opts.video ?? live.current.video
      const api = apiRef.current
      const s = session.current
      if (!v || !api || !live.current.ready || s.initialisedFor !== v.id || s.videoId !== v.id) return

      const now = Date.now()
      if (!opts.force && now - s.lastSaveAt < MIN_GAP_MS) return

      const playerDuration = api.getDuration()
      // While an ad plays, the player reports the *ad's* length and position. Never let that overwrite
      // the real resume position: a duration that doesn't match the video means an ad is on screen.
      const adPlaying = v.live === 'none' && v.durationSeconds > 0 && playerDuration > 0 && Math.abs(playerDuration - v.durationSeconds) > 3
      if (adPlaying) {
        if (s.playingSince) s.playingSince = now // ad time is not watch time
        if (s.hasRow) return // the saved position stays as it was
        opts = { ...opts, ended: false } // first visit during an ad: record the video in History at 0:00
      } else {
        flushWatchTime()
      }
      const duration = adPlaying ? v.durationSeconds : playerDuration || v.durationSeconds
      const progress = adPlaying ? 0 : opts.ended ? duration : api.getCurrentTime()
      if (!opts.force && Math.abs(progress - s.lastSavedProgress) < 1) return

      if (opts.ended) s.completed = true
      const pct = s.completed && opts.ended ? 100 : toPercentage(progress, duration)

      // Interest is credited once per tier, based on the furthest point ever reached.
      const delta = watchInterestDelta(s.creditedPct, pct)
      if (delta > 0) {
        signalQueue.addSignal(signalFromVideo(v, delta))
        s.creditedPct = pct
      }

      s.lastSaveAt = now
      s.lastSavedProgress = progress
      if (!uid || !persist) return
      s.hasRow = true

      const snapshot = {
        video: v,
        progressSeconds: progress,
        durationSeconds: duration,
        watchedSeconds: s.baseWatched + s.watched,
        completed: s.completed,
        startedAt: s.startedAt,
      }
      s.startedAt = undefined
      chain.current = chain.current
        .then(() => saveProgress(uid, snapshot))
        .then(() => {
          // Mark stale without refetching now: Home / History refresh when next opened, and the
          // related-videos ranking on this page doesn't reshuffle while the user is watching.
          void qc.invalidateQueries({ queryKey: qk.continueWatching(uid), refetchType: 'none' })
          void qc.invalidateQueries({ queryKey: qk.history(uid), refetchType: 'none' })
        })
        .catch(() => undefined) // progress saving is best-effort; the next tick retries
    },
    [apiRef, qc],
  )

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
  }

  /** Pass to the player's onStateChange. */
  const onStateChange = useCallback(
    (state: number) => {
      const s = session.current
      const v = live.current.video
      if (state === PlayerState.PLAYING) {
        if (!s.playingSince) s.playingSince = Date.now()
        if (!s.playLogged && v) {
          s.playLogged = true
          signalQueue.addEvent({ videoId: v.id, type: 'play' })
          save({ force: true }) // makes the video appear in history right away
        }
        if (!timer.current) timer.current = setInterval(() => save(), SAVE_INTERVAL_MS)
      } else if (state === PlayerState.PAUSED) {
        stopTimer()
        save({ force: true })
        s.playingSince = 0
        if (v) signalQueue.addEvent({ videoId: v.id, type: 'pause' })
      } else if (state === PlayerState.ENDED) {
        stopTimer()
        save({ force: true, ended: true })
        s.playingSince = 0
        if (v) signalQueue.addEvent({ videoId: v.id, type: 'complete' })
      }
    },
    [save],
  )

  // Leaving the page or hiding the tab: store the latest position.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') save({ force: true })
    }
    const onPageHide = () => save({ force: true })
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [save])

  // Unmount / switching to another video: final save of the video we are leaving, then reset.
  // (Cleanups run before the player loads the next video, so the old position is still readable.
  // This hook must be called before useYouTubePlayer so it also cleans up before the player is destroyed.)
  const videoId = video?.id
  useEffect(() => {
    const leaving = video
    return () => {
      stopTimer()
      if (leaving && session.current.initialisedFor === leaving.id && session.current.lastSavedProgress >= 0) save({ force: true, video: leaving })
      session.current.initialisedFor = ''
      session.current.playingSince = 0
    }
    // `video` is read only to capture the video being left; re-running on id change is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, save])

  return { onStateChange, saveNow: () => save({ force: true }) }
}
