import { useCallback, useEffect, useState } from 'react'
import type { ThemePreference } from '@/types/db'
import { useAuth } from './useAuth'
import { useSettings } from './useSettings'

const KEY = 'vuebox-theme'

function readLocal(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'system' || v === 'dark' ? v : 'dark'
  } catch {
    return 'dark'
  }
}

function apply(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e0f13' : '#ffffff')
}

/** Dark by default. Signed-in users' theme comes from their account; it's also cached locally to avoid a flash. */
export function useTheme() {
  const { isSignedIn } = useAuth()
  const { settings, update } = useSettings()
  const [local, setLocal] = useState<ThemePreference>(readLocal)
  const theme = isSignedIn ? settings.theme : local

  useEffect(() => {
    apply(theme)
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* private mode */
    }
    if (theme !== 'system') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback(
    (t: ThemePreference) => {
      setLocal(t)
      if (isSignedIn) void update({ theme: t })
    },
    [isSignedIn, update],
  )

  return { theme, setTheme }
}
