import { NextRequest, NextResponse } from 'next/server'
import { scrapeNegocios } from '@/lib/scraper'
import { type ScrapeRequest, type ScrapeResponse } from '@/types/business'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest): Promise<NextResponse<ScrapeResponse>> {
  try {
    const { categoria, ubicacion, cantidad } = (await req.json()) as ScrapeRequest
    if (!categoria?.trim() || !ubicacion?.trim())
      return NextResponse.json({ negocios: [], total: 0, error: 'Categoría y ubicación son requeridos.' }, { status: 400 })
    const qty = Math.max(1, Math.min(100, Number(cantidad) || 12))
    console.log(`[api/scrape] POST categoria="${categoria.trim()}" ubicacion="${ubicacion.trim()}" cantidad=${qty}`)
    const negocios = await scrapeNegocios(categoria.trim(), ubicacion.trim(), qty)
    if (negocios.length === 0)
      return NextResponse.json({ negocios: [], total: 0, error: 'No se encontraron negocios. Intenta con otra categoría o ubicación.' })
    return NextResponse.json({ negocios, total: negocios.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido.'
    return NextResponse.json({ negocios: [], total: 0, error: `Error: ${message}` }, { status: 500 })
  }
}
