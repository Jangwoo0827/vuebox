import { useQueryClient } from '@tanstack/react-query'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/Section'
import { Switch } from '@/components/ui/Switch'
import { REGIONS } from '@/constants/categories'
import { useAuth, useProfile } from '@/hooks/useAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSettings } from '@/hooks/useSettings'
import { useTheme } from '@/hooks/useTheme'
import { userMessage } from '@/lib/errors'
import { AUTH_MESSAGES, AuthError, PASSWORD_HINT, isStrongPassword, signOut, updatePassword } from '@/services/authService'
import { clearHistory, clearSearchHistory } from '@/services/historyService'
import { clearAllUserData, deleteAccount } from '@/services/profileService'
import { toast } from '@/stores/toastStore'
import { useUiStore } from '@/stores/uiStore'
import type { ThemePreference } from '@/types/db'

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="card mb-4 p-4 sm:p-5">
      <h2 id={`${id}-h`} className="mb-1 text-lg font-bold">
        {title}
      </h2>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
]

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

export default function SettingsPage() {
  usePageTitle('Settings', '계정과 개인정보 설정')
  const { user, userId } = useAuth()
  const { data: profile } = useProfile()
  const { settings, update } = useSettings()
  const { theme, setTheme } = useTheme()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const privacyPlayer = useUiStore((s) => s.privacyPlayer)
  const setPrivacyPlayer = useUiStore((s) => s.setPrivacyPlayer)

  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [pwBusy, setPwBusy] = useState(false)
  const [dialog, setDialog] = useState<null | 'history' | 'search' | 'data' | 'account'>(null)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(done)
      void qc.invalidateQueries()
      setDialog(null)
    } catch (e) {
      toast.error(userMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!isStrongPassword(pw.next)) return toast.error(`비밀번호 조건: ${PASSWORD_HINT}`)
    if (pw.next !== pw.confirm) return toast.error('비밀번호가 일치하지 않습니다.')
    setPwBusy(true)
    try {
      await updatePassword(pw.next)
      setPw({ next: '', confirm: '' })
      toast.success('비밀번호를 변경했습니다.')
    } catch (err) {
      toast.error(err instanceof AuthError ? AUTH_MESSAGES[err.failure] : AUTH_MESSAGES.unknown)
    } finally {
      setPwBusy(false)
    }
  }

  const removeAccount = () =>
    run(async () => {
      await deleteAccount(user!.email ?? '')
      await signOut()
      navigate('/', { replace: true })
    }, '계정을 삭제했습니다.')

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />

      <Card id="account" title="Account">
        <div className="py-3 text-sm">
          <p className="text-text-secondary">이메일</p>
          <p className="font-medium">{user?.email}</p>
          <p className="mt-2 text-text-secondary">사용자 이름</p>
          <p className="font-medium">
            @{profile?.username ?? '…'}{' '}
            <Link to="/profile" className="ml-2 text-accent underline">
              프로필 편집
            </Link>
          </p>
        </div>
        <form onSubmit={changePassword} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            새 비밀번호
            <input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} placeholder={PASSWORD_HINT} />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            확인
            <input className="input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
          </label>
          <button type="submit" className="btn btn-secondary min-h-11" disabled={pwBusy || !pw.next}>
            비밀번호 변경
          </button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <p className="font-medium text-danger">계정 삭제</p>
            <p className="text-sm text-text-secondary">계정과 모든 데이터(시청 기록, 재생목록, 메모 등)가 영구 삭제됩니다.</p>
          </div>
          <button type="button" className="btn btn-danger" onClick={() => setDialog('account')}>
            계정 삭제
          </button>
        </div>
      </Card>

      <Card id="appearance" title="Appearance">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3" role="group" aria-label="테마">
          <p className="font-medium">테마</p>
          <div className="flex gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" className={`btn ${theme === value ? 'btn-active' : 'btn-secondary'}`} aria-pressed={theme === value} onClick={() => setTheme(value)}>
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card id="playback" title="Playback">
        <Switch label="Autoplay" description="영상이 끝나면 다음 영상을 자동으로 재생하고, 열 때 바로 재생합니다." checked={settings.autoplay} onChange={(v) => void update({ autoplay: v })} />
        <Switch
          label="개인정보 보호 모드 플레이어"
          description="YouTube 공식 youtube-nocookie.com 임베드를 사용합니다. 재생 전에는 쿠키를 쓰지 않으며 이 기기에만 적용됩니다. 광고가 줄어들 수 있지만 보장되지는 않고, YouTube Premium 로그인 혜택은 적용되지 않을 수 있습니다."
          checked={privacyPlayer}
          onChange={setPrivacyPlayer}
        />
        <div className="flex items-center justify-between gap-3 py-3">
          <p className="font-medium">기본 재생 속도</p>
          <select className="input !w-auto" value={settings.default_playback_rate} onChange={(e) => void update({ default_playback_rate: Number(e.target.value) })} aria-label="기본 재생 속도">
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r === 1 ? '보통' : `${r}x`}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card id="privacy" title="Privacy">
        <Switch label="시청 기록 저장" description="끄면 새로 시청하는 영상이 기록되지 않고 이어보기도 동작하지 않습니다." checked={settings.save_watch_history} onChange={(v) => void update({ save_watch_history: v })} />
        <Switch label="검색 기록 저장" description="최근 검색어 제안에 사용됩니다." checked={settings.save_search_history} onChange={(v) => void update({ save_search_history: v })} />
        <Switch label="맞춤 추천" description="끄면 시청·검색 행동이 추천에 반영되지 않고 일반 인기 영상이 표시됩니다." checked={settings.personalization} onChange={(v) => void update({ personalization: v })} />
        <div className="flex flex-wrap gap-2 py-3">
          <button type="button" className="btn btn-secondary" onClick={() => setDialog('history')}>시청 기록 삭제</button>
          <button type="button" className="btn btn-secondary" onClick={() => setDialog('search')}>검색 기록 삭제</button>
          <button type="button" className="btn btn-secondary text-danger" onClick={() => setDialog('data')}>활동·추천 데이터 초기화</button>
        </div>
        <p className="py-3 text-sm text-text-secondary">
          자세한 내용은 <Link to="/privacy" className="text-accent underline">개인정보 처리방침</Link>을 확인하세요.
        </p>
      </Card>

      <Card id="notifications" title="Notifications">
        <Switch label="알림 받기" description="구독 채널의 새 영상, 추천, 재생목록 변화, 리마인더를 알림으로 받습니다." checked={settings.notifications_enabled} onChange={(v) => void update({ notifications_enabled: v })} />
      </Card>

      <Card id="region" title="Region">
        <div className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="font-medium">지역</p>
            <p className="text-sm text-text-secondary">인기 영상과 검색 결과의 기준 지역입니다.</p>
          </div>
          <select className="input !w-auto" value={settings.region} onChange={(e) => void update({ region: e.target.value })} aria-label="지역">
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.code} · {r.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <ConfirmDialog open={dialog === 'history'} title="시청 기록 삭제" danger busy={busy} confirmLabel="삭제" onClose={() => setDialog(null)} onConfirm={() => void run(() => clearHistory(userId!), '시청 기록을 삭제했습니다.')}>
        모든 시청 기록과 이어보기 위치가 삭제됩니다.
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'search'} title="검색 기록 삭제" danger busy={busy} confirmLabel="삭제" onClose={() => setDialog(null)} onConfirm={() => void run(() => clearSearchHistory(userId!), '검색 기록을 삭제했습니다.')}>
        저장된 모든 검색어가 삭제됩니다.
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'data'} title="활동·추천 데이터 초기화" danger busy={busy} confirmLabel="초기화" onClose={() => setDialog(null)} onConfirm={() => void run(() => clearAllUserData(userId!), '데이터를 초기화했습니다.')}>
        시청 기록, 검색 기록, 추천 이벤트, 개인 메모, 추천 프로필이 삭제됩니다. 재생목록·즐겨찾기·구독은 유지됩니다.
      </ConfirmDialog>
      <ConfirmDialog open={dialog === 'account'} title="계정 삭제" danger busy={busy || confirmEmail !== user?.email} confirmLabel="영구 삭제" onClose={() => setDialog(null)} onConfirm={() => void removeAccount()}>
        <p className="mb-3">이 작업은 되돌릴 수 없습니다. 계속하려면 이메일 주소 <strong className="text-text">{user?.email}</strong>를 입력하세요.</p>
        <input className="input" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} aria-label="이메일 확인" autoComplete="off" />
      </ConfirmDialog>
    </div>
  )
}
