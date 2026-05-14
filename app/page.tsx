'use client'
import { useState, useCallback } from 'react'
import { Building2 } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SearchPanel } from '@/components/SearchPanel'
import { ResultsTable } from '@/components/ResultsTable'
import { ExportButton } from '@/components/ExportButton'
import { Toast } from '@/components/Toast'
import { Negocio, SCRAPE_MAX_MS, ScrapeStreamDone } from '@/types/business'

function parseSseBlocks(buffer: string, onBlock: (event: string, data: string) => void): string {
  const parts = buffer.split('\n\n')
  const rest = parts.pop() ?? ''
  for (const block of parts) {
    let ev = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) ev = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
    }
    const data = dataLines.join('\n')
    if (data) onBlock(ev, data)
  }
  return rest
}

export default function Home() {
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [lastSearch, setLastSearch] = useState({ categoria: '', ubicacion: '' })
  const [requestedQty, setRequestedQty] = useState(12)

  const handleSearch = useCallback(async (categoria: string, ubicacion: string, cantidad: number) => {
    setLoading(true)
    setError(null)
    setInfo(null)
    setNegocios([])
    setLastSearch({ categoria, ubicacion })
    setRequestedQty(cantidad)
    const ctrl = new AbortController()
    const clientMaxMs = SCRAPE_MAX_MS + 90_000
    const tid = setTimeout(() => ctrl.abort(), clientMaxMs)
    let buf = ''
    try {
      const res = await fetch('/api/scrape/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ categoria, ubicacion, cantidad }),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        const ct = res.headers.get('content-type') ?? ''
        if (ct.includes('application/json')) {
          const j = (await res.json()) as { error?: string }
          setError(j.error ?? `Error ${res.status}`)
        } else {
          setError(`Error ${res.status}`)
        }
        return
      }
      const reader = res.body?.getReader()
      if (!reader) {
        setError('El servidor no envió datos en streaming.')
        return
      }
      const dec = new TextDecoder()
      let streamDone: ScrapeStreamDone | null = null
      const onSse = (event: string, data: string) => {
        if (event === 'negocio') {
          try {
            const n = JSON.parse(data) as Negocio
            setNegocios(prev => [...prev, n])
          } catch { /* ignore bad chunk */ }
        } else if (event === 'done') {
          try {
            streamDone = JSON.parse(data) as ScrapeStreamDone
          } catch { /* ignore */ }
        } else if (event === 'error') {
          try {
            const j = JSON.parse(data) as { message?: string }
            setError(j.message ?? 'Error en el servidor.')
          } catch {
            setError('Error en el servidor.')
          }
        }
      }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        buf = parseSseBlocks(buf, onSse)
      }
      if (buf.trim()) buf = parseSseBlocks(`${buf}\n\n`, onSse)
      if (streamDone) {
        const { reason, total, requested } = streamDone
        if (total === 0)
          setError('No se encontraron negocios. Intenta con otra categoría o ubicación.')
        else if (reason === 'timeout' && total < requested)
          setInfo(`Tiempo de búsqueda finalizado (${requested} solicitados): ${total} negocios. Puedes exportar el listado.`)
      }
    } catch (e) {
      const aborted = typeof e === 'object' && e !== null && 'name' in e && (e as { name: string }).name === 'AbortError'
      setError(aborted
        ? 'La conexión tardó demasiado o se canceló. Si ya hay filas en la tabla, puedes exportarlas.'
        : 'No se pudo conectar con el servidor.')
    } finally {
      clearTimeout(tid)
      setLoading(false)
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800 bg-[--color-background]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Building2 size={14} className="text-white" />
            </div>
            <span className="font-semibold text-base tracking-tight text-neutral-900 dark:text-neutral-100">Business Prospector</span>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 flex flex-col gap-10">
        <div className="text-center flex flex-col items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Prospecta negocios en segundos</h1>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-lg text-base">Busca por categoría y ubicación, extrae datos públicos y expórtalos a Excel.</p>
        </div>
        <SearchPanel onSearch={handleSearch} loading={loading} />
        {loading && (
          <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto -mt-4">
            Los resultados aparecen al vuelo. Fuentes: <strong>Google Maps</strong> y, si hace falta, <strong>Páginas Amarillas</strong> (web); cada negocio puede enriquecerse desde su sitio. La búsqueda usa hasta 4 minutos; puedes exportar antes si quieres.
          </p>
        )}
        {negocios.length > 0 && (
          <div className="flex justify-end -mb-6">
            <ExportButton negocios={negocios} categoria={lastSearch.categoria} ubicacion={lastSearch.ubicacion} />
          </div>
        )}
        <ResultsTable negocios={negocios} loading={loading} requestedQty={requestedQty} />
      </main>
      <footer className="border-t border-neutral-200 dark:border-neutral-800 py-4">
        <p className="text-center text-xs text-neutral-400 dark:text-neutral-600">Uso personal — extrae datos públicos disponibles en internet</p>
      </footer>
      {error && <Toast message={error} onClose={() => setError(null)} />}
      {info && <Toast message={info} onClose={() => setInfo(null)} />}
    </div>
  )
}
