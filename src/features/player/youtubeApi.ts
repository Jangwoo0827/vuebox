let apiPromise: Promise<void> | null = null

/** Loads the official IFrame Player API exactly once. */
export function loadYouTubeApi(): Promise<void> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise<void>((resolve, reject) => {
    if (window.YT?.Player) return resolve()
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve()
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      apiPromise = null // allow a later retry
      reject(new Error('YouTube player script failed to load'))
    }
    document.head.appendChild(script)
  })
  return apiPromise
}

export type PlayerErrorKind = 'invalid' | 'html5' | 'not-found' | 'not-embeddable' | 'script'

export function classifyPlayerError(code: number): PlayerErrorKind {
  if (code === 2) return 'invalid'
  if (code === 5) return 'html5'
  if (code === 100) return 'not-found'
  if (code === 101 || code === 150) return 'not-embeddable'
  return 'html5'
}

export const PLAYER_ERROR_MESSAGES: Record<PlayerErrorKind, string> = {
  invalid: '잘못된 영상 주소입니다.',
  html5: '플레이어에 문제가 발생했습니다. 새로고침 후 다시 시도해주세요.',
  'not-found': '영상을 찾을 수 없습니다. 삭제되었거나 비공개 상태일 수 있습니다.',
  'not-embeddable': '영상 소유자가 외부 사이트에서의 재생을 허용하지 않았습니다.',
  script: 'YouTube 플레이어를 불러오지 못했습니다. 네트워크를 확인해주세요.',
}

export const youtubeWatchUrl = (id: string, t?: number) => `https://www.youtube.com/watch?v=${id}${t ? `&t=${Math.floor(t)}s` : ''}`

export const PlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const
