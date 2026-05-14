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
}

export default nextConfig
