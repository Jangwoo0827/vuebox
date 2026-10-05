const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const contact = import.meta.env.VITE_CONTACT_EMAIL as string | undefined

export const env = {
  supabaseUrl: url?.replace(/\/$/, '') ?? '',
  supabasePublishableKey: key ?? '',
  /** Shown on the Privacy / Terms pages when set. */
  contactEmail: contact ?? '',
}

export const isConfigured = Boolean(env.supabaseUrl && env.supabasePublishableKey)
