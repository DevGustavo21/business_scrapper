'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Building2 } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AuthNav } from '@/components/AuthNav'
import { SearchPanel } from '@/components/SearchPanel'
import { ResultsTable } from '@/components/ResultsTable'
import { ExportButton } from '@/components/ExportButton'
import { Toast } from '@/components/Toast'
import { SearchCompleteDialog, type SearchCompleteSummary } from '@/components/SearchCompleteDialog'
import {
  SearchHistorySidebar,
  readStoredActiveSearchId,
  writeStoredActiveSearchId,
} from '@/components/SearchHistorySidebar'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import {
  listProspectSearches,
  fetchProspectSearch,
  createProspectSearch,
  updateProspectSearchProgress,
  completeProspectSearch,
  markProspectSearchError,
  formatProspectSearchError,
} from '@/lib/supabase/prospectSearches'
import { SCRAPE_MAX_MS, type ScrapeStreamDone, type ContactoEstado, type Negocio, type NegocioFila } from '@/types/business'
import type { ProspectSearchListItem } from '@/types/prospect-search'

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

function normalizeNegocios(raw: unknown): NegocioFila[] {
  if (!Array.isArray(raw)) return []
  return raw.map((n, i) => {
    const o = n as Partial<NegocioFila>
    const id =
      typeof o.id === 'string' && o.id
        ? o.id
        : typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `row-${i}-${Date.now()}`
    return { ...(o as Negocio), id }
  })
}

export default function Home() {
  const user = useSupabaseUser()
  const [negocios, setNegocios] = useState<NegocioFila[]>([])
  const negociosRef = useRef<NegocioFila[]>([])
  const activeSearchIdRef = useRef<string | null>(null)
  const persistTimerRef = useRef<number | null>(null)

  const [historyItems, setHistoryItems] = useState<ProspectSearchListItem[]>([])
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSearch, setLastSearch] = useState({ categoria: '', ubicacion: '' })
  const [requestedQty, setRequestedQty] = useState(12)
  const [searchCompleteOpen, setSearchCompleteOpen] = useState(false)
  const [searchCompleteSummary, setSearchCompleteSummary] = useState<SearchCompleteSummary | null>(null)

  useEffect(() => {
    negociosRef.current = negocios
  }, [negocios])

  useEffect(() => {
    activeSearchIdRef.current = activeSearchId
  }, [activeSearchId])

  const refreshHistory = useCallback(async (): Promise<ProspectSearchListItem[]> => {
    if (!user || !isSupabaseConfigured()) {
      setHistoryItems([])
      return []
    }
    const sb = createBrowserSupabaseClient()
    const { data, error: err } = await listProspectSearches(sb)
    if (err) {
      console.warn('[history]', err.message)
      return []
    }
    const items = data ?? []
    setHistoryItems(items)
    return items
  }, [user])

  const loadSearchById = useCallback(
    async (id: string) => {
      if (!user || !isSupabaseConfigured()) return
      const sb = createBrowserSupabaseClient()
      const { data, error: err } = await fetchProspectSearch(sb, id)
      if (err || !data) {
        setError(err?.message ?? 'No se pudo cargar la búsqueda.')
        return
      }
      setError(null)
      setActiveSearchId(id)
      writeStoredActiveSearchId(id)
      setNegocios(normalizeNegocios(data.negocios))
      setLastSearch({ categoria: data.categoria, ubicacion: data.ubicacion })
      setRequestedQty(data.cantidad_solicitada)
    },
    [user],
  )

  useEffect(() => {
    if (user === undefined) return
    if (!user) {
      setHistoryItems([])
      setActiveSearchId(null)
      writeStoredActiveSearchId(null)
      setNegocios([])
      return
    }
    void (async () => {
      const items = await refreshHistory()
      const stored = readStoredActiveSearchId()
      const pick = stored && items.some(x => x.id === stored) ? stored : null
      if (pick) await loadSearchById(pick)
    })()
  }, [user, refreshHistory, loadSearchById])

  const handleNewChat = useCallback(() => {
    if (loading) return
    setActiveSearchId(null)
    writeStoredActiveSearchId(null)
    setNegocios([])
    setLastSearch({ categoria: '', ubicacion: '' })
    setRequestedQty(12)
    setError(null)
  }, [loading])

  const handleEstadoChange = useCallback(
    (id: string, estado: ContactoEstado) => {
      setNegocios(prev => {
        const next = prev.map(r => (r.id === id ? { ...r, estado } : r))
        const sid = activeSearchIdRef.current
        if (sid && user && isSupabaseConfigured()) {
          window.setTimeout(() => {
            void updateProspectSearchProgress(createBrowserSupabaseClient(), sid, next)
          }, 0)
        }
        return next
      })
    },
    [user],
  )

  const flushPersistTimer = () => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }
  }

  const scheduleCloudPersist = (persistId: string) => {
    if (!user || !isSupabaseConfigured()) return
    flushPersistTimer()
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null
      void updateProspectSearchProgress(createBrowserSupabaseClient(), persistId, negociosRef.current)
    }, 800)
  }

  const handleSearch = useCallback(
    async (categoria: string, ubicacion: string, cantidad: number) => {
      setLoading(true)
      flushPersistTimer()
      setError(null)
      setSearchCompleteOpen(false)
      setSearchCompleteSummary(null)
      setNegocios([])
      setLastSearch({ categoria, ubicacion })
      setRequestedQty(cantidad)

      /** Filas solo de esta ejecución (evita carrera si otra búsqueda muta `negociosRef` antes del persist). */
      const streamRows: NegocioFila[] = []

      let persistId: string | null = null
      if (user && isSupabaseConfigured()) {
        const sb = createBrowserSupabaseClient()
        const { id, error: ce } = await createProspectSearch(sb, user.id, { categoria, ubicacion, cantidad })
        if (ce || !id) {
          setError(ce ? formatProspectSearchError(ce.message) : 'No se pudo crear el historial en la nube. Inténtalo de nuevo.')
        } else {
          persistId = id
          setActiveSearchId(id)
          writeStoredActiveSearchId(id)
          await refreshHistory()
        }
      }

      const ctrl = new AbortController()
      const clientMaxMs = SCRAPE_MAX_MS + 90_000
      const tid = window.setTimeout(() => ctrl.abort(), clientMaxMs)
      let buf = ''
      const streamMeta: { done: ScrapeStreamDone | null } = { done: null }

      const markRowError = async () => {
        if (!persistId || !user || !isSupabaseConfigured()) return
        await markProspectSearchError(createBrowserSupabaseClient(), persistId)
        await refreshHistory()
      }

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
          await markRowError()
          return
        }
        const reader = res.body?.getReader()
        if (!reader) {
          setError('El servidor no envió datos en streaming.')
          await markRowError()
          return
        }
        const dec = new TextDecoder()
        const onSse = (event: string, data: string) => {
          if (event === 'negocio') {
            try {
              const n = JSON.parse(data) as Negocio
              const rowId =
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                  ? crypto.randomUUID()
                  : `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
              const row: NegocioFila = { ...n, id: rowId }
              streamRows.push(row)
              setNegocios(prev => {
                const next = [...prev, row]
                negociosRef.current = next
                return next
              })
              if (persistId) scheduleCloudPersist(persistId)
            } catch {
              /* ignore */
            }
          } else if (event === 'done') {
            try {
              streamMeta.done = JSON.parse(data) as ScrapeStreamDone
            } catch {
              /* ignore */
            }
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
      } catch (e) {
        const aborted =
          typeof e === 'object' && e !== null && 'name' in e && (e as { name: string }).name === 'AbortError'
        setError(
          aborted
            ? 'La conexión tardó demasiado o se canceló. Si ya hay filas en la tabla, puedes exportarlas.'
            : 'No se pudo conectar con el servidor.',
        )
        await markRowError()
      } finally {
        window.clearTimeout(tid)
        flushPersistTimer()
        const doneSnapshot = streamMeta.done
        try {
          if (persistId && user && isSupabaseConfigured()) {
            const sb = createBrowserSupabaseClient()
            await updateProspectSearchProgress(sb, persistId, streamRows)
            if (doneSnapshot) {
              await completeProspectSearch(sb, persistId, streamRows, { reason: doneSnapshot.reason })
            } else {
              await completeProspectSearch(sb, persistId, streamRows, { reason: 'timeout' })
            }
            await refreshHistory()
          }

          if (doneSnapshot) {
            setSearchCompleteSummary({
              reason: doneSnapshot.reason,
              total: doneSnapshot.total,
              requested: doneSnapshot.requested,
              categoria,
              ubicacion,
            })
            setSearchCompleteOpen(true)
          }
        } catch (e) {
          console.warn('[search] persist / resumen:', e)
        } finally {
          setLoading(false)
        }
      }
    },
    [user, refreshHistory],
  )

  const loggedIn = Boolean(user && isSupabaseConfigured())

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800 bg-[--color-background]/80 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Building2 size={14} className="text-white" />
            </div>
            <span className="font-semibold text-base tracking-tight text-neutral-900 dark:text-neutral-100 truncate">
              Business Prospector
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <AuthNav />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col sm:flex-row min-h-0 max-w-[1600px] mx-auto w-full">
        <SearchHistorySidebar
          items={historyItems}
          activeId={activeSearchId}
          loading={loading}
          disabled={loading}
          loggedIn={loggedIn}
          onNew={handleNewChat}
          onSelect={id => {
            if (loading) return
            void loadSearchById(id)
          }}
        />

        <main className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-8">
          <div className="text-center flex flex-col items-center gap-3 max-w-2xl mx-auto">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Prospecta negocios en segundos
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-lg text-sm sm:text-base">
              Cada búsqueda es un chat en el historial (si inicias sesión). Los datos se guardan en la nube y sobreviven a
              recargar la página.
            </p>
          </div>
          <SearchPanel onSearch={handleSearch} loading={loading} />
          {loading && (
            <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto -mt-4">
              Los resultados aparecen al vuelo. Fuentes: <strong>Google Maps</strong> y, si hace falta,{' '}
              <strong>Páginas Amarillas</strong>. Hasta 4 minutos por búsqueda.
            </p>
          )}
          {negocios.length > 0 && (
            <div className="flex justify-end -mb-4">
              <ExportButton
                negocios={negocios}
                categoria={lastSearch.categoria}
                etiquetaUbicacion={lastSearch.ubicacion}
              />
            </div>
          )}
          <ResultsTable
            negocios={negocios}
            loading={loading}
            requestedQty={requestedQty}
            onEstadoChange={handleEstadoChange}
          />
        </main>
      </div>

      <footer className="border-t border-neutral-200 dark:border-neutral-800 py-4 shrink-0">
        <p className="text-center text-xs text-neutral-400 dark:text-neutral-600">
          Uso personal — extrae datos públicos disponibles en internet
        </p>
      </footer>

      {error && <Toast message={error} onClose={() => setError(null)} />}
      <SearchCompleteDialog
        open={searchCompleteOpen}
        summary={searchCompleteSummary}
        onClose={() => {
          setSearchCompleteOpen(false)
          setSearchCompleteSummary(null)
        }}
      />
    </div>
  )
}
