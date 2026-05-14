import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabasePublicEnv } from './env'

export async function createServerSupabaseClient() {
  const { url, anonKey } = getSupabasePublicEnv()
  if (!url || !anonKey) {
    throw new Error('Faltan variables de entorno de Supabase')
  }
  const cookieStore = await cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          /* set desde Server Component sin mutar cookies */
        }
      },
    },
  })
}
