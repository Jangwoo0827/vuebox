import { LogOut, Monitor, Moon, Settings, Sun, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth, useProfile } from '@/hooks/useAuth'
import { usePopover } from '@/hooks/usePopover'
import { useTheme } from '@/hooks/useTheme'
import { signOut } from '@/services/authService'
import type { ThemePreference } from '@/types/db'

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
]

export function ProfileMenu() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { theme, setTheme } = useTheme()
  const { open, setOpen, ref } = usePopover()
  const navigate = useNavigate()

  if (!user) {
    return (
      <Link to="/login" className="btn btn-secondary !min-h-9">
        <User className="size-4" aria-hidden /> 로그인
      </Link>
    )
  }

  const name = profile?.display_name ?? user.email ?? 'User'
  const item = 'flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm hover:bg-surface-hover'

  return (
    <div ref={ref} className="relative">
      <button type="button" data-popover-trigger className="flex size-10 items-center justify-center rounded-full" aria-label="계정 메뉴" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        <Avatar src={profile?.avatar_url} name={name} size={32} />
      </button>
      {open && (
        <div role="menu" className="fade-up absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow)]">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <Avatar src={profile?.avatar_url} name={name} size={40} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{name}</p>
              <p className="truncate text-sm text-text-secondary">{profile ? `@${profile.username}` : user.email}</p>
            </div>
          </div>
          <Link role="menuitem" to="/profile" className={item} onClick={() => setOpen(false)}>
            <User className="size-4" aria-hidden /> 프로필
          </Link>
          <Link role="menuitem" to="/settings" className={item} onClick={() => setOpen(false)}>
            <Settings className="size-4" aria-hidden /> 설정
          </Link>
          <div className="flex gap-1 border-y border-border p-2" role="group" aria-label="테마">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)} className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium ${theme === value ? 'bg-accent-soft text-accent' : 'hover:bg-surface-hover'}`}>
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={async () => {
              setOpen(false)
              await signOut()
              navigate('/')
            }}
          >
            <LogOut className="size-4" aria-hidden /> 로그아웃
          </button>
        </div>
      )}
    </div>
  )
}
