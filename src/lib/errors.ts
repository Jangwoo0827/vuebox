export type AppErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'YOUTUBE_API_ERROR'
  | 'NETWORK'
  | 'SUPABASE'
  | 'CHART_UNAVAILABLE'
  | 'BAD_REQUEST'
  | 'INTERNAL'

export class AppError extends Error {
  code: AppErrorCode

  constructor(code: AppErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

const MESSAGES: Record<AppErrorCode, string> = {
  QUOTA_EXCEEDED: 'YouTube API 일일 사용량을 초과했습니다. 잠시 후 다시 시도해주세요.',
  RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  NOT_FOUND: '요청한 항목을 찾을 수 없습니다.',
  UNAUTHENTICATED: '로그인이 필요합니다.',
  YOUTUBE_API_ERROR: 'YouTube에서 데이터를 가져오지 못했습니다.',
  NETWORK: '네트워크 연결을 확인해주세요.',
  SUPABASE: '데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
  CHART_UNAVAILABLE: '이 지역/카테고리의 인기 영상을 제공하지 않습니다.',
  BAD_REQUEST: '잘못된 요청입니다.',
  INTERNAL: '알 수 없는 오류가 발생했습니다.',
}

export function userMessage(error: unknown): string {
  if (error instanceof AppError) return MESSAGES[error.code]
  return MESSAGES.INTERNAL
}

export const isQuotaError = (e: unknown) => e instanceof AppError && e.code === 'QUOTA_EXCEEDED'

/** Wrap a Supabase PostgREST error so the UI shows a friendly message without leaking internals. */
export function fromSupabase(error: { message: string; code?: string }): AppError {
  if (import.meta.env.DEV) console.warn('[supabase]', error.code, error.message)
  if (error.code === 'PGRST301' || error.code === '42501') return new AppError('UNAUTHENTICATED', error.message)
  return new AppError('SUPABASE', error.message)
}
