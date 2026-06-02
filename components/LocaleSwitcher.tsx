'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Globe, Check } from 'lucide-react'
import { routing, translatePathname, type AppLocale } from '@/i18n/routing'
import { cn } from '@/lib/utils'

const LABEL_KEY: Record<AppLocale, 'english' | 'spanish'> = {
  en: 'english',
  es: 'spanish',
}

/**
 * Construye la URL equivalente en `nextLocale` para la ubicación actual del
 * navegador. Soporta cualquier ruta declarada en `routing.pathnames` (incluso
 * dinámicas) reemplazando solo los segmentos traducibles.
 */
function localizedCurrentHref(nextLocale: AppLocale): string {
  const { pathname, search, hash } = window.location
  const segments = pathname.split('/')
  const firstSegment = segments[1]
  const hasLocalePrefix = (routing.locales as readonly string[]).includes(firstSegment)
  const pathWithoutLocale = hasLocalePrefix ? `/${segments.slice(2).join('/')}` : pathname

  if (pathWithoutLocale === '/' || pathWithoutLocale === '') {
    return `/${nextLocale}${search}${hash}`
  }

  return `/${nextLocale}${translatePathname(pathWithoutLocale, nextLocale)}${search}${hash}`
}

/**
 * Selector de idioma compacto. Usa la navegación de `next-intl` para que
 * el cambio:
 *  - Mantenga la ruta actual (solo cambia el prefijo `/es/` ↔ `/en/`).
 *  - Persista en la cookie `NEXT_LOCALE` automáticamente.
 *
 * La sincronización con `profiles.preferred_locale` (Supabase) se hace
 * desde un hook aparte (`useSyncProfileLocale`) para no acoplar.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as AppLocale
  const t = useTranslations('locale')
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const change = (next: AppLocale) => {
    setOpen(false)
    if (next === locale) return
    startTransition(() => {
      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
      window.location.assign(localizedCurrentHref(next))
    })
  }

  return (
    <div className={cn('relative', className)} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('switcherLabel')}
        title={t('switcherLabel')}
        disabled={isPending}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-700 backdrop-blur transition-colors',
          'hover:border-neutral-300 hover:bg-white',
          'dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-200 dark:hover:bg-white/[0.08]',
          'disabled:opacity-50',
        )}
      >
        <Globe size={13} aria-hidden />
        {locale.toUpperCase()}
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('switcherLabel')}
          className="absolute right-0 z-50 mt-2 min-w-[140px] overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-neutral-900"
        >
          {routing.locales.map(code => {
            const active = code === locale
            return (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => change(code)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors',
                    active
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200'
                      : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800',
                  )}
                >
                  <span>{t(LABEL_KEY[code])}</span>
                  {active && <Check size={14} aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
