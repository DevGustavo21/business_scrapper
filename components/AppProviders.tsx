'use client'

import { ThemeProvider } from '@/components/ThemeProvider'
import { OAuthReturnHandler } from '@/components/OAuthReturnHandler'

/**
 * Providers que viven sólo en el cliente. Se aisla aquí (en lugar de inline
 * en el layout) para mantener al layout como Server Component puro.
 *
 * El tema inicial se lee desde cookie en el layout para evitar renderizar
 * scripts dentro del árbol React.
 */
export function AppProviders({
  children,
  initialTheme,
}: {
  children: React.ReactNode
  initialTheme: 'light' | 'dark' | 'system'
}) {
  return (
    <ThemeProvider initialTheme={initialTheme}>
      <OAuthReturnHandler />
      {children}
    </ThemeProvider>
  )
}
