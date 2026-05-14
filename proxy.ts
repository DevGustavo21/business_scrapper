import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/updateSession'

/**
 * Si la «Site URL» de Supabase es solo el dominio, OAuth puede volver a `/?code=…` o `/login?code=…`
 * en lugar de `/auth/callback`. Sin ese route no hay `exchangeCodeForSession` ni cookies de sesión.
 */
export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const code = url.searchParams.get('code')
  const skipOAuthRedirect =
    !code ||
    url.pathname === '/auth/callback' ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/_next')

  if (!skipOAuthRedirect) {
    const dest = new URL('/auth/callback', request.url)
    dest.search = url.search
    return NextResponse.redirect(dest)
  }
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
