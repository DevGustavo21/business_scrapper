import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabasePublicEnv, isSupabaseConfigured } from '@/lib/supabase/env'

/**
 * Intercambio OAuth: las cookies de sesión deben ir en el `NextResponse` que se devuelve.
 * Usar solo `cookies()` del servidor suele no enviar Set-Cookie con el redirect (especialmente en Vercel).
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const { searchParams, origin } = requestUrl
  const code = searchParams.get('code')
  const nextRaw = searchParams.get('next')?.replace(/[^\w/\-]/g, '') || '/'
  const path = nextRaw.startsWith('/') ? nextRaw : '/'

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL('/login?error=config', origin).toString())
  }

  const { url: sbUrl, anonKey } = getSupabasePublicEnv()

  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const base =
    process.env.NODE_ENV === 'production' && forwardedHost
      ? `${forwardedProto ?? 'https'}://${forwardedHost}`
      : origin
  const successRedirect = new URL(path, base).toString()
  const errorRedirect = new URL('/auth/auth-code-error', base).toString()

  if (code) {
    const response = NextResponse.redirect(successRedirect)

    const supabase = createServerClient(sbUrl, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return response
    console.error('[auth/callback] exchangeCodeForSession:', error.message)
  }

  return NextResponse.redirect(errorRedirect)
}
