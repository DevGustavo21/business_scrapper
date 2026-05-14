import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicEnv } from './env'

/** Refresco de sesión Supabase (no nombrar este archivo `middleware.ts`: choca con el de Next). */
export async function updateSession(request: NextRequest) {
  const { url, anonKey } = getSupabasePublicEnv()
  if (!url || !anonKey) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  await supabase.auth.getUser()

  return supabaseResponse
}
