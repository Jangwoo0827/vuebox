import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Only the publishable key ever reaches the browser. Access control is enforced by RLS.
// When env vars are missing the app renders a setup screen instead of using this client.
export const supabase = createClient(env.supabaseUrl || 'http://localhost:54321', env.supabasePublishableKey || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
