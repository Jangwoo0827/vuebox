import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { PageHeader } from '@/components/ui/Section'
import { ErrorState, LoadingState } from '@/components/ui/StateViews'
import { useAuth, useProfile } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { usePageTitle } from '@/hooks/usePageTitle'
import { AppError, userMessage } from '@/lib/errors'
import { qk } from '@/lib/queryKeys'
import { USERNAME_RE, isUsernameAvailable, updateProfile, uploadAvatar } from '@/services/profileService'
import { toast } from '@/stores/toastStore'
import { formatDate } from '@/utils/format'

export default function ProfilePage() {
  usePageTitle('Profile', '내 프로필')
  const { user, userId } = useAuth()
  const profileQ = useProfile()
  const profile = profileQ.data
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ displayName: '', username: '', bio: '' })
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    if (profile) setForm({ displayName: profile.display_name, username: profile.username, bio: profile.bio })
  }, [profile])

  const wanted = useDebounce(form.username.trim().toLowerCase(), 400)
  useEffect(() => {
    if (!profile || wanted === profile.username || !USERNAME_RE.test(wanted)) return setAvailable(null)
    let cancelled = false
    isUsernameAvailable(wanted)
      .then((ok) => !cancelled && setAvailable(ok))
      .catch(() => !cancelled && setAvailable(null))
    return () => {
      cancelled = true
    }
  }, [wanted, profile])

  const refresh = () => void qc.invalidateQueries({ queryKey: qk.profile(userId!) })

  const save = useMutation({
    mutationFn: () => updateProfile(userId!, { display_name: form.displayName.trim(), username: form.username.trim().toLowerCase(), bio: form.bio.trim() }),
    onSuccess: () => {
      toast.success('프로필을 저장했습니다.')
      refresh()
    },
    onError: (e) => toast.error(e instanceof AppError && e.message === 'username taken' ? '이미 사용 중인 사용자 이름입니다.' : userMessage(e)),
  })

  const avatar = useMutation({
    mutationFn: async (file: File) => updateProfile(userId!, { avatar_url: await uploadAvatar(userId!, file) }),
    onSuccess: () => {
      toast.success('프로필 사진을 변경했습니다.')
      refresh()
    },
    onError: (e) => toast.error(e instanceof AppError && e.code === 'BAD_REQUEST' ? e.message : userMessage(e)),
  })

  if (profileQ.isPending) return <LoadingState />
  if (profileQ.isError || !profile) return <ErrorState error={profileQ.error} message="프로필을 불러오지 못했습니다." onRetry={() => void profileQ.refetch()} />

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) avatar.mutate(file)
  }

  const usernameError = form.username && !USERNAME_RE.test(form.username.toLowerCase()) ? '영문 소문자, 숫자, 밑줄(_) 3~20자' : available === false ? '이미 사용 중인 사용자 이름입니다.' : null
  const dirty = form.displayName !== profile.display_name || form.username !== profile.username || form.bio !== profile.bio
  const canSave = dirty && !usernameError && form.displayName.trim().length > 0 && !save.isPending

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (canSave) save.mutate()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" description={`가입일 ${formatDate(profile.created_at)}`} />
      <div className="card p-5 sm:p-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="relative">
            <Avatar src={profile.avatar_url} name={profile.display_name} size={88} />
            <button type="button" className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full border border-border bg-surface-2 hover:bg-surface-hover" aria-label="프로필 사진 변경" onClick={() => fileRef.current?.click()} disabled={avatar.isPending}>
              {avatar.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{profile.display_name}</p>
            <p className="truncate text-sm text-text-secondary">@{profile.username}</p>
            <p className="truncate text-sm text-text-secondary">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            표시 이름
            <input className="input" value={form.displayName} maxLength={40} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} required />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            사용자 이름
            <input className="input" value={form.username} maxLength={20} autoCapitalize="none" spellCheck={false} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} required />
            {usernameError ? <span role="alert" className="text-xs font-normal text-danger">{usernameError}</span> : available && <span className="text-xs font-normal text-success">사용할 수 있는 이름입니다.</span>}
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            소개
            <textarea className="input min-h-24 py-2" value={form.bio} maxLength={300} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
            <span className="self-end text-xs font-normal text-text-secondary">{form.bio.length}/300</span>
          </label>
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={!canSave}>
              {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />} 저장
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
