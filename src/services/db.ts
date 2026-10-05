import type { PostgrestError } from '@supabase/supabase-js'
import { fromSupabase } from '@/lib/errors'

/** Unwrap a Supabase response, throwing an AppError for failures. */
export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw fromSupabase(res.error)
  return res.data as T
}

export function check(res: { error: PostgrestError | null }): void {
  if (res.error) throw fromSupabase(res.error)
}

export const isUniqueViolation = (e: unknown) => e instanceof Error && /duplicate key|23505/.test(e.message)
