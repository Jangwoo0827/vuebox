import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'

interface AuthState {
  session: Session | null
  user: User | null
  /** False until the initial getSession() resolves. */
  ready: boolean
  setSession: (s: Session | null) => void
  setReady: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  ready: false,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setReady: () => set({ ready: true }),
}))
