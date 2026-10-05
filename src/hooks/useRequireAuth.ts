import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from '@/stores/toastStore'
import { useAuth } from './useAuth'

/** Wrap an action that needs an account: signed-out users get a toast with a "Log in" shortcut. */
export function useRequireAuth() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(
    <A extends unknown[]>(fn: (userId: string, ...args: A) => void | Promise<void>) =>
      (...args: A) => {
        if (userId) return fn(userId, ...args)
        toast.withAction('로그인하면 사용할 수 있는 기능입니다.', {
          label: '로그인',
          run: () => navigate('/login', { state: { from: location.pathname + location.search } }),
        })
      },
    [userId, navigate, location],
  )
}
