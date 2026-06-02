import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { AppProviders } from '@/components/AppProviders'
import { routing } from '@/i18n/routing'
import '../globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const THEME_COOKIE = 'bp-theme'

export const metadata: Metadata = {
  title: 'Business Prospector — Búsqueda de negocios',
  description: 'Busca, extrae y exporta datos de negocios locales',
}

/** Evita HTML cacheado sin el flujo OAuth actual (p. ej. CDN). */
export const dynamic = 'force-dynamic'

/** Pregenera variantes estáticas posibles del segmento `[locale]`. */
export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }))
}

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)

  /** Mensajes cargados server-side; el provider los expone a los client components. */
  const messages = await getMessages()
  const cookieStore = await cookies()
  const storedTheme = cookieStore.get(THEME_COOKIE)?.value
  const initialTheme = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : 'system'
  const initialThemeClass = initialTheme === 'system' ? '' : ` ${initialTheme}`

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}${initialThemeClass}`}
    >
      <body
        className="min-h-screen bg-[--color-background] text-[--color-foreground]"
        suppressHydrationWarning
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders initialTheme={initialTheme}>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
