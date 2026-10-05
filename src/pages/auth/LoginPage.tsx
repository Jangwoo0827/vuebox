import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { AUTH_MESSAGES, AuthError, isEmail, signIn } from '@/services/authService'
import { AuthLayout, Field } from './AuthLayout'

export default function LoginPage() {
  usePageTitle('로그인')
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const { isSignedIn, ready } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (ready && isSignedIn) return <Navigate to={from} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isEmail(email)) return setError('올바른 이메일 주소를 입력해주세요.')
    if (!password) return setError('비밀번호를 입력해주세요.')
    setBusy(true)
    try {
      await signIn(email.trim(), password, remember)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof AuthError ? AUTH_MESSAGES[err.failure] : AUTH_MESSAGES.unknown)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="로그인"
      subtitle="VUEBOX 계정으로 시청 기록과 추천을 이어가세요."
      footer={
        <>
          계정이 없으신가요?{' '}
          <Link to="/signup" state={location.state} className="font-semibold text-accent hover:underline">
            회원가입
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="이메일">
          <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="비밀번호">
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex min-h-10 items-center gap-2">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            로그인 상태 유지
          </label>
          <Link to="/forgot-password" className="text-accent hover:underline">
            비밀번호를 잊으셨나요?
          </Link>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary min-h-11" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} 로그인
        </button>
      </form>
    </AuthLayout>
  )
}
