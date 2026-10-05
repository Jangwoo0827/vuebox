import { Loader2, MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { AUTH_MESSAGES, AuthError, PASSWORD_HINT, isEmail, isStrongPassword, requestPasswordReset, updatePassword } from '@/services/authService'
import { toast } from '@/stores/toastStore'
import { AuthLayout, Field } from './AuthLayout'

/** Step 1: email a recovery link (official Supabase flow). */
export function ForgotPasswordPage() {
  usePageTitle('비밀번호 재설정')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isEmail(email)) return setError('올바른 이메일 주소를 입력해주세요.')
    setBusy(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true) // same message whether or not the account exists
    } catch (err) {
      setError(err instanceof AuthError ? AUTH_MESSAGES[err.failure] : AUTH_MESSAGES.unknown)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="비밀번호 재설정" subtitle="가입한 이메일로 재설정 링크를 보내드립니다." footer={<Link to="/login" className="font-semibold text-accent hover:underline">로그인으로 돌아가기</Link>}>
      {sent ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck className="size-10 text-accent" aria-hidden />
          <p className="text-sm text-text-secondary">입력하신 주소로 가입된 계정이 있다면 재설정 링크를 보냈습니다. 메일함을 확인해주세요.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="이메일">
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary min-h-11" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} 재설정 링크 보내기
          </button>
        </form>
      )}
    </AuthLayout>
  )
}

/** Step 2: the emailed link signs the user in with a recovery session; they choose a new password here. */
export function ResetPasswordPage() {
  usePageTitle('새 비밀번호 설정')
  const { isSignedIn, ready } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isStrongPassword(password)) return setError(`비밀번호 조건: ${PASSWORD_HINT}`)
    if (password !== confirm) return setError('비밀번호가 일치하지 않습니다.')
    setBusy(true)
    try {
      await updatePassword(password)
      toast.success('비밀번호를 변경했습니다.')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof AuthError ? AUTH_MESSAGES[err.failure] : AUTH_MESSAGES.unknown)
    } finally {
      setBusy(false)
    }
  }

  if (ready && !isSignedIn) {
    return (
      <AuthLayout title="링크가 만료되었습니다" footer={<Link to="/login" className="font-semibold text-accent hover:underline">로그인으로 돌아가기</Link>}>
        <p className="text-sm text-text-secondary">재설정 링크가 만료되었거나 이미 사용되었습니다. 다시 요청해주세요.</p>
        <Link to="/forgot-password" className="btn btn-primary mt-4 w-full">
          재설정 링크 다시 받기
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="새 비밀번호 설정">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="새 비밀번호" hint={PASSWORD_HINT}>
          <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Field label="새 비밀번호 확인">
          <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary min-h-11" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} 비밀번호 변경
        </button>
      </form>
    </AuthLayout>
  )
}
