import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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

export default nextConfig
