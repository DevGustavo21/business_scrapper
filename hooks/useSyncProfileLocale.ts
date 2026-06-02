'use client'

import { useEffect, useRef } from 'react'
import { useLocale } from 'next-intl'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { fetchMyProfile, updateMyPreferredLocale } from '@/lib/supabase/profiles'
import { isAppLocale } from '@/i18n/routing'

const LOCALE_COOKIE = 'NEXT_LOCALE'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split('; ').find(c => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  const oneYear = 60 * 60 * 24 * 365
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${oneYear}; samesite=lax`
}

/**
 * Mantiene `profiles.preferred_locale` ↔ cookie ↔ locale actual.
 *
 *  - Al iniciar sesión, si el perfil tiene una preferencia distinta a la
 *    cookie/URL, la cookie se actualiza (la navegación siguiente la usará).
 *  - Si la cookie/URL cambian (el usuario usó el switcher), se persiste en
 *    el perfil para que sobreviva entre dispositivos.
 *
 * Es seguro montarlo varias veces; sólo dispara la escritura si hay diff.
 */
export function useSyncProfileLocale() {
  const user = useSupabaseUser()
  const locale = useLocale()
  const lastWrittenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return
    if (!isAppLocale(locale)) return
    let cancelled = false

    void (async () => {
      const sb = createBrowserSupabaseClient()
      const { data } = await fetchMyProfile(sb, user.id)
      if (cancelled) return

      const stored = data?.preferred_locale ?? null

      /** El locale activo es distinto al guardado: actualizamos el perfil. */
      if (stored !== locale && lastWrittenRef.current !== locale) {
        lastWrittenRef.current = locale
        await updateMyPreferredLocale(sb, user.id, locale)
        writeCookie(LOCALE_COOKIE, locale)
        return
      }

      /** El perfil guarda algo distinto a la cookie actual: arrastramos la cookie. */
      const cookieLocale = readCookie(LOCALE_COOKIE)
      if (stored && stored !== cookieLocale) {
        writeCookie(LOCALE_COOKIE, stored)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, locale])
}
