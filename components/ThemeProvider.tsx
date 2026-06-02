'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Theme provider propio (reemplaza `next-themes`).
 *
 * - El tema inicial se lee desde cookie en el Server Component de layout. Eso
 *   evita renderizar cualquier `<script>` dentro del árbol React, que React 19
 *   reporta como warning en desarrollo.
 * - El provider sólo se encarga de exponer `theme`, `resolvedTheme` y
 *   `setTheme` con la misma firma básica que `useTheme()` de next-themes,
 *   para no romper consumidores existentes (`ThemeToggle`).
 */

type ResolvedTheme = 'light' | 'dark'
type Theme = ResolvedTheme | 'system'

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (next: Theme) => void
}

const STORAGE_KEY = 'bp-theme'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const ThemeContext = createContext<ThemeContextValue | null>(null)

function resolveSystem(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    /* localStorage puede no estar disponible (privacy mode, SSR) */
  }
  return 'system'
}

export function ThemeProvider({
  children,
  initialTheme = 'system',
}: {
  children: React.ReactNode
  initialTheme?: Theme
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    initialTheme === 'system' ? 'light' : initialTheme,
  )

  useEffect(() => {
    const stored = readStoredTheme()
    setThemeState(stored)
    setResolvedTheme(stored === 'system' ? resolveSystem() : stored)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const effective = theme === 'system' ? resolveSystem() : theme
    setResolvedTheme(effective)

    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(effective)
    root.style.colorScheme = effective
  }, [theme])

  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const effective: ResolvedTheme = media.matches ? 'dark' : 'light'
      setResolvedTheme(effective)
      const root = document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(effective)
      root.style.colorScheme = effective
    }
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
      document.cookie = `${STORAGE_KEY}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
    } catch {
      /* ignore quota / privacy errors */
    }
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Reemplazo de `useTheme()` de `next-themes`. Soporta la API mínima usada en
 * la app: `{ theme, resolvedTheme, setTheme }`.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    /* Fallback silencioso para evitar errores si el árbol se renderiza fuera del provider en tests. */
    return {
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: () => {
        /* no-op */
      },
    }
  }
  return ctx
}
