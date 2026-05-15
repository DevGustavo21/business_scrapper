import type { SupabaseClient } from '@supabase/supabase-js'

export async function upsertMyProfile(supabase: SupabaseClient, userId: string, email: string) {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email: email.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  return { error: error ? new Error(error.message) : null }
}
