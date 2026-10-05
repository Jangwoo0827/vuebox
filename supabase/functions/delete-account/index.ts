// Deletes the calling user's account. All user data is removed by ON DELETE CASCADE foreign keys.
// The service-role key is only ever used here, on the server, after verifying the caller's JWT.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, HttpError, json } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) })
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'POST only')

    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !anonKey || !serviceKey) throw new HttpError(500, 'SERVER_MISCONFIGURED', 'Server is not configured')

    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in first')

    const caller = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data, error } = await caller.auth.getUser(token)
    if (error || !data.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Invalid session')

    const body = (await req.json().catch(() => ({}))) as { confirm?: unknown }
    if (body.confirm !== data.user.email) throw new HttpError(400, 'CONFIRMATION_MISMATCH', 'Email confirmation does not match')

    // Best effort: remove the avatar folder (storage rows are not covered by FK cascade).
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: files } = await admin.storage.from('avatars').list(data.user.id)
    if (files?.length) await admin.storage.from('avatars').remove(files.map((f) => `${data.user.id}/${f.name}`))

    const { error: delError } = await admin.auth.admin.deleteUser(data.user.id)
    if (delError) throw new HttpError(500, 'DELETE_FAILED', 'Could not delete the account')

    return json(req, { data: { deleted: true } })
  } catch (e) {
    if (e instanceof HttpError) return json(req, { error: { code: e.code, message: e.message } }, e.status)
    console.error(e)
    return json(req, { error: { code: 'INTERNAL', message: 'Unexpected error' } }, 500)
  }
})
