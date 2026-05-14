import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublicEnv } from './env'

export function createBrowserSupabaseClient() {
  const { url, anonKey } = getSupabasePublicEnv()
  if (!url || !anonKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createBrowserClient(url, anonKey)
}
