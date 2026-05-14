import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { OAuthReturnHandler } from '@/components/OAuthReturnHandler'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Business Prospector — Búsqueda de negocios',
  description: 'Busca, extrae y exporta datos de negocios locales',
}

/** Evita HTML de `/` cacheado sin el flujo OAuth actual (p. ej. CDN). */
export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body
        className="min-h-screen bg-[--color-background] text-[--color-foreground]"
        suppressHydrationWarning
      >
        <script
          dangerouslySetInnerHTML={{
            __html:
              "!function(){try{var p=location.pathname;if(p==='/auth/callback'||p.indexOf('/api')===0)return;if(!new URLSearchParams(location.search).get('code'))return;location.replace(location.origin+'/auth/callback'+location.search)}catch(e){}}();",
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="bp-theme">
          <OAuthReturnHandler />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
