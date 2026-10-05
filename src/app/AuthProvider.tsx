import { useEffect, type ReactNode } from 'react'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { markSessionActive, shouldDropEphemeralSession } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

/** Restores the Supabase session on load and mirrors auth changes into the store. */
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let active = true
    const { setSession, setReady } = useAuthStore.getState()

    // Don't await Supabase calls inside this callback (it can deadlock the auth lock): just record state.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'SIGNED_OUT') queryClient.clear() // never leave one user's cached data around
    })

    void (async () => {
      if (shouldDropEphemeralSession()) await supabase.auth.signOut({ scope: 'local' })
      else markSessionActive()
      const { data } = await supabase.auth.getSession()
      if (!active) return
      setSession(data.session)
      setReady()
    })()

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return children
}
