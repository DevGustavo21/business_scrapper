import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Solo el binario serverless: si externalizamos playwright-core, en Vercel suele faltar browsers.json.
  serverExternalPackages: ['@sparticuz/chromium'],
}

export default nextConfig
