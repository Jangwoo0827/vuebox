import { Loader2, MailCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { usePageTitle } from '@/hooks/usePageTitle'
import { AUTH_MESSAGES, AuthError, PASSWORD_HINT, isEmail, isStrongPassword, signUp } from '@/services/authService'
import { USERNAME_RE, isUsernameAvailable } from '@/services/profileService'
import { AuthLayout, Field } from './AuthLayout'

type Availability = 'idle' | 'checking' | 'available' | 'taken'

export default function SignupPage() {
  usePageTitle('회원가입')
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const { isSignedIn, ready } = useAuth()

  const [form, setForm] = useState({ email: '', password: '', confirm: '', username: '', displayName: '' })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [availability, setAvailability] = useState<Availability>('idle')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }))

  // Live username availability (debounced RPC; only after the format is valid).
  const username = useDebounce(form.username.trim().toLowerCase(), 400)
  useEffect(() => {
    if (!USERNAME_RE.test(username)) return setAvailability('idle')
    let cancelled = false
    setAvailability('checking')
    isUsernameAvailable(username)
      .then((ok) => !cancelled && setAvailability(ok ? 'available' : 'taken'))
      .catch(() => !cancelled && setAvailability('idle'))
    return () => {
      cancelled = true
    }
  }, [username])

  const errors = {
    email: form.email && !isEmail(form.email) ? '올바른 이메일 형식이 아닙니다.' : null,
    password: form.password && !isStrongPassword(form.password) ? `비밀번호 조건: ${PASSWORD_HINT}` : null,
    confirm: form.confirm && form.confirm !== form.password ? '비밀번호가 일치하지 않습니다.' : null,
    username: form.username && !USERNAME_RE.test(form.username.toLowerCase()) ? '영문 소문자, 숫자, 밑줄(_)만 사용하여 3~20자로 입력해주세요.' : availability === 'taken' ? '이미 사용 중인 사용자 이름입니다.' : null,
    displayName: form.displayName && form.displayName.trim().length > 40 ? '40자 이하로 입력해주세요.' : null,
  }
  const show = (k: keyof typeof errors) => (touched[k] || form[k].length > 0 ? errors[k] : null)

  if (ready && isSignedIn) return <Navigate to={from} replace />

  if (sentTo) {
    return (
      <AuthLayout title="이메일을 확인해주세요" footer={<Link to="/login" className="font-semibold text-accent hover:underline">로그인으로 돌아가기</Link>}>
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck className="size-10 text-accent" aria-hidden />
          <p className="text-sm text-text-secondary">
            <strong className="text-text">{sentTo}</strong> 주소로 인증 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료한 뒤 로그인해주세요.
          </p>
        </div>
      </AuthLayout>
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setTouched({ email: true, password: true, confirm: true, username: true, displayName: true })
    const missing = !form.email || !form.password || !form.confirm || !form.username || !form.displayName.trim()
    if (missing || Object.values(errors).some(Boolean)) return setError('입력 내용을 확인해주세요.')
    setBusy(true)
    try {
      const { needsConfirmation } = await signUp({ email: form.email.trim(), password: form.password, username: form.username, displayName: form.displayName })
      if (needsConfirmation) setSentTo(form.email.trim())
      else navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof AuthError ? AUTH_MESSAGES[err.failure] : AUTH_MESSAGES.unknown)
    } finally {
      setBusy(false)
    }
  }

  const availabilityHint = availability === 'checking' ? '확인 중…' : availability === 'available' ? '사용할 수 있는 이름입니다.' : '영문 소문자, 숫자, 밑줄 3~20자'

  return (
    <AuthLayout
      title="회원가입"
      subtitle="무료로 시작하고 시청 기록과 추천을 모든 기기에서 사용하세요."
      footer={
        <>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" state={location.state} className="font-semibold text-accent hover:underline">
            로그인
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="이메일" error={show('email')}>
          <input className="input" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} onBlur={blur('email')} required />
        </Field>
        <Field label="사용자 이름" error={show('username')} hint={availabilityHint}>
          <input className="input" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20} value={form.username} onChange={set('username')} onBlur={blur('username')} required />
        </Field>
        <Field label="표시 이름" error={show('displayName')}>
          <input className="input" autoComplete="nickname" maxLength={40} value={form.displayName} onChange={set('displayName')} onBlur={blur('displayName')} required />
        </Field>
        <Field label="비밀번호" error={show('password')} hint={PASSWORD_HINT}>
          <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} onBlur={blur('password')} required />
        </Field>
        <Field label="비밀번호 확인" error={show('confirm')}>
          <input className="input" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} onBlur={blur('confirm')} required />
        </Field>
        <p className="text-xs text-text-secondary">
          가입하면 <Link to="/terms" className="underline">이용약관</Link>과 <Link to="/privacy" className="underline">개인정보 처리방침</Link>에 동의하게 됩니다.
        </p>
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary min-h-11" disabled={busy || availability === 'taken'}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} 가입하기
        </button>
      </form>
    </AuthLayout>
  )
}
