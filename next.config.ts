import type { NextConfig } from 'next'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import createNextIntlPlugin from 'next-intl/plugin'

const projectRoot = dirname(fileURLToPath(import.meta.url))

/** next-intl: ruta absoluta para que funcione tanto en dev como en build. */
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  // Binario serverless (no empaquetar el .br dentro del bundle JS).
  serverExternalPackages: ['@sparticuz/chromium'],
  // NFT no detecta require() dinámico de browsers.json dentro de playwright-core (Vercel #211).
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/playwright-core/browsers.json',
      './node_modules/playwright-core/lib/**/*',
    ],
  },
  /** Antes del proxy: envía `/?code=…` al route handler que hace `exchangeCodeForSession` (conserva query). */
  async redirects() {
    return [
      {
        source: '/',
        has: [{ type: 'query', key: 'code' }],
        destination: '/auth/callback',
        permanent: false,
      },
      {
        source: '/login',
        has: [{ type: 'query', key: 'code' }],
        destination: '/auth/callback',
        permanent: false,
      },
    ]
  },
}

export default withNextIntl(nextConfig)
