import { NextResponse, type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { updateSession } from './lib/supabase/updateSession'

/**
 * Proxy (antes `middleware.ts`, renombrado en Next.js 16).
 *
 * Orden de responsabilidades:
 *  1. OAuth: si llega `?code=…` fuera de `/auth/callback`, redirigir allí
 *     para que se complete `exchangeCodeForSession`.
 *  2. Para rutas internas (`/api`, `/auth/callback`, assets) solo refrescamos
 *     la sesión de Supabase: no necesitan locale.
 *  3. Para todo lo demás, ejecutamos `next-intl` (que añade prefijo, lee la
 *     cookie de locale, detecta `Accept-Language`, etc.) y luego `updateSession`
 *     para que las cookies de Supabase queden frescas.
 */
const intlMiddleware = createMiddleware(routing)

function isInternalPath(pathname: string): boolean {
  return (
    pathname === '/auth/callback' ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_vercel')
  )
}

export async function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl

  /** 1. OAuth `?code=…` que cae fuera del callback (Supabase «Site URL» = dominio). */
  const code = searchParams.get('code')
  if (code && !isInternalPath(pathname)) {
    const dest = new URL('/auth/callback', request.url)
    dest.search = search
    return NextResponse.redirect(dest)
  }

  /** 2. Rutas internas: solo refrescar sesión. */
  if (isInternalPath(pathname)) {
    return updateSession(request)
  }

  /** 3. Locale + sesión. */
  const intlResponse = intlMiddleware(request)

  /** Si `next-intl` redirige (p. ej. `/precios` → `/es/precios`), devolverlo tal cual. */
  if (intlResponse.headers.get('location')) {
    return intlResponse
  }

  const sessionResponse = await updateSession(request)

  /** Preservamos los headers internos que escribe `next-intl` (rewrite, locale). */
  intlResponse.headers.forEach((value, key) => {
    if (key.toLowerCase().startsWith('x-middleware') || key.toLowerCase().startsWith('x-next')) {
      sessionResponse.headers.set(key, value)
    }
  })

  return sessionResponse
}

export const config = {
  /**
   * Saltamos rutas de Next.js internas y cualquier archivo estático servido
   * desde `public/` (extensiones comunes). Importante: hay que excluir `.js`
   * para que assets públicos no se prefijen con locale.
   */
  matcher: [
    '/',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|map|js|css|txt|xml|json|woff|woff2|ttf|otf)$).*)',
  ],
}
