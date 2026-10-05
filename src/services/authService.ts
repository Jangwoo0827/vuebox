import { AppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { appUrl } from '@/lib/url'

export interface SignUpInput {
  email: string
  password: string
  username: string
  displayName: string
}

const EPHEMERAL = 'vuebox-ephemeral'
const ACTIVE = 'vuebox-active'

/** "Remember session" off ⇒ the session ends when the browser is closed (see AuthProvider). */
export function setRememberSession(remember: boolean) {
  try {
    if (remember) localStorage.removeItem(EPHEMERAL)
    else localStorage.setItem(EPHEMERAL, '1')
    sessionStorage.setItem(ACTIVE, '1')
  } catch {
    /* storage unavailable: behave as remembered */
  }
}

export function shouldDropEphemeralSession(): boolean {
  try {
    return localStorage.getItem(EPHEMERAL) === '1' && sessionStorage.getItem(ACTIVE) !== '1'
  } catch {
    return false
  }
}

export function markSessionActive() {
  try {
    sessionStorage.setItem(ACTIVE, '1')
  } catch {
    /* ignore */
  }
}

export type AuthFailure = 'invalid-credentials' | 'email-not-confirmed' | 'exists' | 'weak-password' | 'rate-limited' | 'unknown'

export class AuthError extends AppError {
  failure: AuthFailure

  constructor(failure: AuthFailure) {
    super('UNAUTHENTICATED', failure)
    this.failure = failure
  }
}

function classify(message: string, status?: number): AuthFailure {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'invalid-credentials'
  if (m.includes('not confirmed')) return 'email-not-confirmed'
  if (m.includes('already registered') || m.includes('already been registered')) return 'exists'
  if (m.includes('password')) return 'weak-password'
  if (status === 429 || m.includes('rate limit')) return 'rate-limited'
  return 'unknown'
}

export const AUTH_MESSAGES: Record<AuthFailure, string> = {
  'invalid-credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
  'email-not-confirmed': '이메일 인증을 먼저 완료해주세요.',
  exists: '이미 가입된 이메일입니다.',
  'weak-password': '비밀번호가 요구 조건을 충족하지 않습니다.',
  'rate-limited': '시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
  unknown: '문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
}

/** Returns `needsConfirmation` when the project requires email verification before the first sign-in. */
export async function signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { username: input.username.toLowerCase(), display_name: input.displayName.trim() },
      emailRedirectTo: appUrl('login'),
    },
  })
  if (error) throw new AuthError(classify(error.message, error.status))
  return { needsConfirmation: !data.session }
}

export async function signIn(email: string, password: string, remember: boolean): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new AuthError(classify(error.message, error.status))
  setRememberSession(remember)
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/** Official Supabase reset flow: emails a link that returns to /reset-password with a recovery session. */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl('reset-password') })
  if (error) throw new AuthError(classify(error.message, error.status))
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new AuthError(classify(error.message, error.status))
}

export const PASSWORD_HINT = '8자 이상, 대문자·소문자·숫자 포함'
export const isStrongPassword = (p: string) => p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p)
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
