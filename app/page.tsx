'use client'

import { Suspense, useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { cn } from '@/lib/utils'
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
import { ShareResourceDialog } from '@/components/ShareResourceDialog'
import { AddSearchToFolderDialog } from '@/components/AddSearchToFolderDialog'
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
  deleteProspectSearch,
  formatProspectSearchError,
} from '@/lib/supabase/prospectSearches'
import {
  fetchProspectMarksForSearch,
  mergeProspectMarksIntoNegocios,
  insertProspectFromSearch,
  deleteClientProspectById,
  updateClientProspectEstado,
  formatClientProspectError,
} from '@/lib/supabase/clientProspects'
import { SCRAPE_MAX_MS, type ScrapeStreamDone, type ContactoEstado, type Negocio, type NegocioFila } from '@/types/business'
import type { ProspectSearchListItem } from '@/types/prospect-search'
import type { ProspectListRow } from '@/types/collaboration'
import { listProspectListsForUser } from '@/lib/supabase/collaboration'
import {
  fetchExcludeFingerprintsForSearch,
  removeProspectBlacklistByFingerprint,
  replaceSearchResultFingerprints,
  upsertProspectBlacklist,
} from '@/lib/supabase/prospectPipeline'
import { stableBusinessFingerprint } from '@/lib/businessDedupe'
import { normalizeNegocios } from '@/lib/negociosRows'
import { MarkProspectDialog, type MarkProspectDest, loadProspectListsForMark } from '@/components/MarkProspectDialog'

function parseSseBlocks(buffer: string, onBlock: (event: string, data: string) => void): string {
  const normalized = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const parts = normalized.split('\n\n')
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

function HomeInner() {
  const user = useSupabaseUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlSearchId = searchParams.get('search')
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
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false)
  const [shareSearchOpen, setShareSearchOpen] = useState(false)
  const [addFolderOpen, setAddFolderOpen] = useState(false)
  const [prospectLists, setProspectLists] = useState<ProspectListRow[]>([])
  const [markDialogOpen, setMarkDialogOpen] = useState(false)
  const [markRow, setMarkRow] = useState<NegocioFila | null>(null)
  const [shareNewListOpen, setShareNewListOpen] = useState(false)
  const [shareNewListId, setShareNewListId] = useState<string | null>(null)
  const [shareNewListTitle, setShareNewListTitle] = useState('')

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) {
      setProspectLists([])
      return
    }
    const sb = createBrowserSupabaseClient()
    void listProspectListsForUser(sb, user.id).then(({ data }) => setProspectLists(data))
  }, [user])

  useEffect(() => {
    if (markDialogOpen && user && isSupabaseConfigured()) {
      void loadProspectListsForMark(createBrowserSupabaseClient(), user.id).then(setProspectLists)
    }
  }, [markDialogOpen, user])

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
    const { data, error: err } = await listProspectSearches(sb, user.id)
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
      if (data.user_id !== user.id) {
        router.replace(`/busqueda-compartida/${encodeURIComponent(id)}`)
        return
      }
      setError(null)
      setActiveSearchId(id)
      writeStoredActiveSearchId(id)
      const raw = normalizeNegocios(data.negocios)
      const { map, error: markErr } = await fetchProspectMarksForSearch(sb, id)
      if (markErr) console.warn('[prospect marks]', markErr.message)
      setNegocios(mergeProspectMarksIntoNegocios(raw, map))
      setLastSearch({ categoria: data.categoria, ubicacion: data.ubicacion })
      setRequestedQty(data.cantidad_solicitada)
    },
    [user, router],
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
      if (urlSearchId) {
        await loadSearchById(urlSearchId)
        return
      }
      const stored = readStoredActiveSearchId()
      const storedPick = stored && items.some(x => x.id === stored) ? stored : null
      if (storedPick) await loadSearchById(storedPick)
    })()
  }, [user, refreshHistory, loadSearchById, urlSearchId])

  const handleNewChat = useCallback(() => {
    if (loading) return
    setActiveSearchId(null)
    writeStoredActiveSearchId(null)
    setNegocios([])
    setLastSearch({ categoria: '', ubicacion: '' })
    setRequestedQty(12)
    setError(null)
    setMobileHistoryOpen(false)
  }, [loading])

  const handleDeleteSearch = useCallback(
    async (id: string) => {
      if (!user || !isSupabaseConfigured()) return
      if (!window.confirm('¿Eliminar esta búsqueda del historial? No se puede deshacer.')) return
      const sb = createBrowserSupabaseClient()
      const { error: delErr } = await deleteProspectSearch(sb, id)
      if (delErr) {
        setError(formatProspectSearchError(delErr.message))
        return
      }
      if (activeSearchIdRef.current === id) {
        setActiveSearchId(null)
        writeStoredActiveSearchId(null)
        setNegocios([])
        setLastSearch({ categoria: '', ubicacion: '' })
        setRequestedQty(12)
      }
      await refreshHistory()
    },
    [user, refreshHistory],
  )

  const handleEstadoChange = useCallback(
    (id: string, estado: ContactoEstado) => {
      const prevRow = negociosRef.current.find(r => r.id === id)
      const prevEstado = prevRow?.estado
      setNegocios(prev => {
        const next = prev.map(r => (r.id === id ? { ...r, estado } : r))
        const row = next.find(r => r.id === id)
        if (row?.prospectRecordId && user && isSupabaseConfigured()) {
          void updateClientProspectEstado(createBrowserSupabaseClient(), row.prospectRecordId, estado)
        }
        const sid = activeSearchIdRef.current
        if (sid && user && isSupabaseConfigured()) {
          window.setTimeout(() => {
            void updateProspectSearchProgress(createBrowserSupabaseClient(), sid, next)
          }, 0)
        }
        return next
      })
      if (user && isSupabaseConfigured() && prevRow && prevEstado !== estado) {
        const fp = stableBusinessFingerprint(prevRow)
        const sb = createBrowserSupabaseClient()
        if (estado === 'No interesado') {
          void upsertProspectBlacklist(sb, user.id, fp, prevRow.nombre, prevRow.prospectRecordId ?? null)
        } else if (prevEstado === 'No interesado') {
          void removeProspectBlacklistByFingerprint(sb, user.id, fp)
        }
      }
    },
    [user],
  )

  const flushPersistTimer = () => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }
  }

  const scheduleCloudPersist = useCallback((persistId: string) => {
    if (!user || !isSupabaseConfigured()) return
    flushPersistTimer()
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null
      void updateProspectSearchProgress(createBrowserSupabaseClient(), persistId, negociosRef.current)
    }, 800)
  }, [user])

  const confirmMarkProspect = useCallback(
    async (dest: MarkProspectDest) => {
      if (!user || !isSupabaseConfigured()) return
      const sid = activeSearchIdRef.current
      const row = markRow
      if (!sid || !row) return
      const listId = dest.kind === 'personal' ? null : dest.listId
      const sb = createBrowserSupabaseClient()
      const { id: pid, error: insErr } = await insertProspectFromSearch(sb, user.id, sid, row, listId)
      if (insErr || !pid) {
        setError(formatClientProspectError(insErr?.message))
        return
      }
      setNegocios(prev => prev.map(r => (r.id === row.id ? { ...r, esProspecto: true, prospectRecordId: pid } : r)))
      scheduleCloudPersist(sid)
      setMarkRow(null)
      if (dest.kind === 'shared_new') {
        setShareNewListId(dest.listId)
        setShareNewListTitle(dest.name)
        setShareNewListOpen(true)
      }
    },
    [user, markRow, scheduleCloudPersist],
  )

  const handleProspectToggle = useCallback(
    async (row: NegocioFila) => {
      if (!user || !isSupabaseConfigured()) {
        setError('Inicia sesión para marcar prospectos.')
        return
      }
      const sid = activeSearchIdRef.current
      if (!sid) {
        setError('Activa una búsqueda del historial (o lanza una nueva con sesión iniciada) para usar el corazón.')
        return
      }
      const sb = createBrowserSupabaseClient()
      if (row.esProspecto && row.prospectRecordId) {
        const { error: delErr } = await deleteClientProspectById(sb, row.prospectRecordId)
        if (delErr) {
          setError(formatClientProspectError(delErr.message))
          return
        }
        setNegocios(prev =>
          prev.map(r => (r.id === row.id ? { ...r, esProspecto: false, prospectRecordId: null } : r)),
        )
      } else {
        setMarkRow(row)
        setMarkDialogOpen(true)
        return
      }
      scheduleCloudPersist(sid)
    },
    [user, scheduleCloudPersist],
  )

  const handleDeleteNegocioRow = useCallback(
    (row: NegocioFila) => {
      if (
        !window.confirm(
          '¿Eliminar esta fila de los resultados? Se quitará de la búsqueda guardada. Si estaba como prospecto, también se borrará de Clientes prospectos.',
        )
      )
        return
      flushPersistTimer()
      const sid = activeSearchIdRef.current
      void (async () => {
        if (row.prospectRecordId && user && isSupabaseConfigured()) {
          const { error: delErr } = await deleteClientProspectById(createBrowserSupabaseClient(), row.prospectRecordId)
          if (delErr) {
            setError(formatClientProspectError(delErr.message))
            return
          }
        }
        setNegocios(prev => {
          const next = prev.filter(r => r.id !== row.id)
          negociosRef.current = next
          if (sid && user && isSupabaseConfigured()) {
            void updateProspectSearchProgress(createBrowserSupabaseClient(), sid, next)
          }
          return next
        })
      })()
    },
    [user],
  )

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

      let excludeFingerprints: string[] = []
      if (user && isSupabaseConfigured()) {
        const sbEx = createBrowserSupabaseClient()
        const ex = await fetchExcludeFingerprintsForSearch(sbEx, user.id, categoria, ubicacion)
        if (!ex.error) excludeFingerprints = ex.keys
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

      const rowBatch: NegocioFila[] = []
      let flushScheduled = false
      const flushPendingRows = () => {
        if (rowBatch.length === 0) return
        const batch = rowBatch.splice(0, rowBatch.length)
        setNegocios(prev => {
          const next = [...prev, ...batch]
          negociosRef.current = next
          return next
        })
        if (persistId) scheduleCloudPersist(persistId)
      }
      const scheduleFlushRows = () => {
        if (flushScheduled) return
        flushScheduled = true
        queueMicrotask(() => {
          flushScheduled = false
          flushPendingRows()
        })
      }

      try {
        const res = await fetch('/api/scrape/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          body: JSON.stringify({ categoria, ubicacion, cantidad, excludeFingerprints }),
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
              rowBatch.push(row)
              scheduleFlushRows()
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
        flushPendingRows()
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
        flushPendingRows()
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
            const { error: fpErr } = await replaceSearchResultFingerprints(
              sb,
              user.id,
              persistId,
              categoria,
              ubicacion,
              streamRows,
            )
            if (fpErr) console.warn('[fingerprints]', fpErr.message)
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
    [user, refreshHistory, scheduleCloudPersist],
  )

  const loggedIn = Boolean(user && isSupabaseConfigured())

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        showMobileHistoryTrigger
        onOpenMobileHistory={() => setMobileHistoryOpen(true)}
      />

      {mobileHistoryOpen && (
        <button
          type="button"
          aria-label="Cerrar historial"
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setMobileHistoryOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col sm:flex-row min-h-0 max-w-[1600px] mx-auto w-full relative">
        <SearchHistorySidebar
          items={historyItems}
          activeId={activeSearchId}
          loading={loading}
          disabled={loading}
          loggedIn={loggedIn}
          onNew={handleNewChat}
          onDelete={handleDeleteSearch}
          onSelect={id => {
            if (loading) return
            void loadSearchById(id)
            setMobileHistoryOpen(false)
          }}
          className={cn(
            'max-sm:fixed max-sm:top-14 max-sm:bottom-0 max-sm:left-0 max-sm:z-50 max-sm:w-[min(92vw,300px)] max-sm:border-r max-sm:border-neutral-200 dark:max-sm:border-neutral-800 max-sm:shadow-2xl max-sm:transition-transform max-sm:duration-300 max-sm:bg-neutral-50 max-sm:dark:bg-neutral-950',
            mobileHistoryOpen ? 'max-sm:translate-x-0' : 'max-sm:-translate-x-full',
            'sm:translate-x-0',
          )}
          sidebarFooter={
            <Link
              href="/settings/lista-negra"
              className="block w-full text-center text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/80"
            >
              Configuración
            </Link>
          }
        />

        <main className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-8">
          <div className="text-center flex flex-col items-center gap-3 max-w-2xl mx-auto">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Prospecta negocios en segundos
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-lg text-sm sm:text-base">
              Cada búsqueda <strong>tuya</strong> queda en el historial lateral (con sesión iniciada). Lo que comparte un
              compañero en una carpeta se abre en una vista aparte, no mezclada con tu historial.
            </p>
          </div>
          <SearchPanel onSearch={handleSearch} loading={loading} />
          {loading && (
            <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto -mt-4">
              Fuentes: <strong>Google Maps</strong> y, si hace falta, <strong>Páginas Amarillas</strong>. Las filas se van
              sumando al vuelo; la extracción completa puede tardar <strong>hasta unos 4 minutos</strong>. Cuando ya veas
              datos en la tabla, la búsqueda <strong>sigue en segundo plano</strong> hasta el botón vuelva a «Buscar».
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
          {loggedIn && activeSearchId && user && (
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-between items-stretch sm:items-center max-w-4xl mx-auto w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/40 px-4 py-3">
              <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-md">
                Al marcar con el corazón elige si va a tu <strong>lista personal</strong> o a una{' '}
                <strong>lista compartida</strong> (nueva o existente).
              </p>
              <div className="flex flex-wrap gap-2 items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShareSearchOpen(true)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Compartir búsqueda
                </button>
                <button
                  type="button"
                  onClick={() => setAddFolderOpen(true)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Añadir a carpeta
                </button>
              </div>
            </div>
          )}
          <ResultsTable
            negocios={negocios}
            loading={loading && negocios.length === 0}
            streamActive={loading && negocios.length > 0}
            requestedQty={requestedQty}
            onEstadoChange={handleEstadoChange}
            detailHref={row =>
              row.prospectRecordId ? `/prospecto/${encodeURIComponent(row.prospectRecordId)}` : null
            }
            prospectHeart={
              loggedIn && activeSearchId
                ? {
                    enabled: true,
                    disabled: loading && negocios.length === 0,
                    onToggle: handleProspectToggle,
                  }
                : undefined
            }
            deleteRow={
              loggedIn && activeSearchId
                ? {
                    enabled: true,
                    disabled: loading && negocios.length === 0,
                    title: 'Eliminar esta fila de la búsqueda',
                    onDelete: handleDeleteNegocioRow,
                  }
                : undefined
            }
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

      {loggedIn && user && (
        <MarkProspectDialog
          open={markDialogOpen}
          onClose={() => {
            setMarkDialogOpen(false)
            setMarkRow(null)
          }}
          row={markRow}
          userId={user.id}
          lists={prospectLists}
          onConfirm={confirmMarkProspect}
        />
      )}

      {loggedIn && shareNewListOpen && shareNewListId && user && (
        <ShareResourceDialog
          open={shareNewListOpen}
          onClose={() => {
            setShareNewListOpen(false)
            setShareNewListId(null)
            setShareNewListTitle('')
          }}
          title={shareNewListTitle || 'Lista compartida'}
          resourceType="prospect_list"
          resourceId={shareNewListId}
          inviterUserId={user.id}
          inviterEmail={user.email ?? undefined}
        />
      )}

      {loggedIn && activeSearchId && user && (
        <>
          <ShareResourceDialog
            open={shareSearchOpen}
            onClose={() => setShareSearchOpen(false)}
            title={`${lastSearch.categoria} · ${lastSearch.ubicacion}`}
            resourceType="prospect_search"
            resourceId={activeSearchId}
            inviterUserId={user.id}
            inviterEmail={user.email ?? undefined}
          />
          <AddSearchToFolderDialog
            open={addFolderOpen}
            onClose={() => setAddFolderOpen(false)}
            userId={user.id}
            prospectSearchId={activeSearchId}
            searchLabel={`${lastSearch.categoria} · ${lastSearch.ubicacion}`}
          />
        </>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          Cargando…
        </div>
      }
    >
      <HomeInner />
    </Suspense>
  )
}
