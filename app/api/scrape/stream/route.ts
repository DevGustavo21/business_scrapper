import { NextRequest, NextResponse } from 'next/server'
import { streamScrapeNegocios } from '@/lib/scraper'
import type { Negocio } from '@/types/business'
import { type ScrapeRequest, type ScrapeStreamDone, SCRAPE_MAX_MS } from '@/types/business'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const MAX_SSE_TEXT = 4500

function clipNegocioForSse(n: Negocio): Negocio {
  const clip = (s: string) => (s.length > MAX_SSE_TEXT ? `${s.slice(0, MAX_SSE_TEXT)}…` : s)
  return {
    ...n,
    problemasDetectados: clip(n.problemasDetectados),
    oportunidades: clip(n.oportunidades),
  }
}

function sseEncode(event: string, data: unknown): Uint8Array {
  const payload = typeof data === 'string' ? data : JSON.stringify(data)
  const text = `event: ${event}\ndata: ${payload}\n\n`
  return new TextEncoder().encode(text)
}

export async function POST(req: NextRequest): Promise<Response> {
  let categoria = ''
  let ubicacion = ''
  let qty = 12
  try {
    const body = (await req.json()) as ScrapeRequest
    categoria = body.categoria?.trim() ?? ''
    ubicacion = body.ubicacion?.trim() ?? ''
    if (!categoria || !ubicacion)
      return NextResponse.json({ error: 'Categoría y ubicación son requeridos.' }, { status: 400 })
    qty = Math.max(1, Math.min(100, Number(body.cantidad) || 12))
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  console.log(`[api/scrape/stream] POST categoria="${categoria}" ubicacion="${ubicacion}" cantidad=${qty}`)

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(sseEncode(event, data))
      }
      try {
        const { reason, total, requested } = await streamScrapeNegocios(categoria, ubicacion, qty, SCRAPE_MAX_MS, n =>
          send('negocio', clipNegocioForSse(n)),
        )
        const done: ScrapeStreamDone = { reason, total, requested }
        send('done', done)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido.'
        send('error', { message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
