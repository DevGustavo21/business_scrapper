import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Binarios y nativos no deben empaquetarse en el bundle del servidor.
  serverExternalPackages: ['@sparticuz/chromium', 'playwright-core', 'playwright'],
}

export default nextConfig
