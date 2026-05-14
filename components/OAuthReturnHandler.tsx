'use client'

import { useEffect } from 'react'

/**
 * Si Supabase devuelve `?code=` a una ruta distinta de `/auth/callback`, el intercambio PKCE
 * no ocurre y no hay cookies de sesión. El proxy debería redirigir antes; esto cubre edge cases
 * (CDN, caché, o despliegues donde el proxy no aplica a esa petición).
 */
export function OAuthReturnHandler() {
  useEffect(() => {
    const pathname = window.location.pathname
    if (pathname === '/auth/callback') return
    if (pathname.startsWith('/api')) return
    if (!new URLSearchParams(window.location.search).get('code')) return
    window.location.replace(`${window.location.origin}/auth/callback${window.location.search}`)
  }, [])
  return null
}
