import {
  getRecommendationProfile,
  recordEvents,
  saveRecommendationProfile,
  type RecommendationEvent,
} from '@/services/recommendationService'
import { PROFILE } from './config'
import { applySignals, type InterestSignal } from './profile'

/**
 * Batches interest signals and events and writes them at most once per interval, so a burst of
 * actions (play, like, save…) costs one profile update instead of one per action.
 */
class SignalQueue {
  private userId: string | null = null
  private enabled = false
  private signals: InterestSignal[] = []
  private events: RecommendationEvent[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private flushing: Promise<void> = Promise.resolve()
  private onFlushed: (() => void) | null = null

  /** Called on auth/settings changes. Switching users flushes the previous user's queue first. */
  configure(userId: string | null, enabled: boolean, onFlushed?: () => void) {
    if (this.userId && this.userId !== userId) void this.flush()
    this.userId = userId
    this.enabled = enabled && !!userId
    this.onFlushed = onFlushed ?? null
    if (!this.enabled) {
      this.signals = []
      this.events = []
    }
  }

  addSignal(signal: InterestSignal) {
    if (!this.enabled) return
    this.signals.push(signal)
    this.schedule()
  }

  addEvent(event: RecommendationEvent) {
    if (!this.enabled) return
    this.events.push(event)
    this.schedule()
  }

  private schedule() {
    if (this.timer) return
    this.timer = setTimeout(() => void this.flush(), PROFILE.flushIntervalMs)
  }

  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const userId = this.userId
    const signals = this.signals
    const events = this.events
    this.signals = []
    this.events = []
    if (!userId || (signals.length === 0 && events.length === 0)) return this.flushing

    this.flushing = this.flushing.then(async () => {
      try {
        if (signals.length) {
          const profile = await getRecommendationProfile(userId)
          await saveRecommendationProfile(userId, applySignals(profile, signals))
        }
        await recordEvents(userId, events)
        this.onFlushed?.()
      } catch (e) {
        // Recommendations are best-effort: drop the batch rather than retry forever.
        if (import.meta.env.DEV) console.warn('[recommendations] flush failed', e)
      }
    })
    return this.flushing
  }
}

export const signalQueue = new SignalQueue()

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void signalQueue.flush()
  })
  window.addEventListener('pagehide', () => void signalQueue.flush())
}
