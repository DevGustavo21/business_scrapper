'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { ResultsTable } from '@/components/ResultsTable'
import { ExportButton } from '@/components/ExportButton'
import { Toast } from '@/components/Toast'
import { ShareResourceDialog } from '@/components/ShareResourceDialog'
import { MarkProspectDialog, type MarkProspectDest, loadProspectListsForMark } from '@/components/MarkProspectDialog'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { fetchProspectSearch, updateProspectSearchProgress } from '@/lib/supabase/prospectSearches'
import {
  fetchProspectMarksForSearch,
  mergeProspectMarksIntoNegocios,
  insertProspectFromSearch,
  deleteClientProspectById,
  updateClientProspectEstado,
  formatClientProspectError,
} from '@/lib/supabase/clientProspects'
import { listProspectListsForUser } from '@/lib/supabase/collaboration'
import {
  upsertProspectBlacklist,
  removeProspectBlacklistByFingerprint,
} from '@/lib/supabase/prospectPipeline'
import { stableBusinessFingerprint } from '@/lib/businessDedupe'
import type { ContactoEstado, NegocioFila } from '@/types/business'
import type { ProspectListRow } from '@/types/collaboration'
import { normalizeNegocios } from '@/lib/negociosRows'

function BusquedaCompartidaInner() {
  const params = useParams()
  const router = useRouter()
  const searchId = typeof params.searchId === 'string' ? params.searchId : ''
  const user = useSupabaseUser()

  const [negocios, setNegocios] = useState<NegocioFila[]>([])
  const negociosRef = useRef<NegocioFila[]>([])
  const [categoria, setCategoria] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [requestedQty, setRequestedQty] = useState(12)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [prospectLists, setProspectLists] = useState<ProspectListRow[]>([])
  const [markDialogOpen, setMarkDialogOpen] = useState(false)
  const [markRow, setMarkRow] = useState<NegocioFila | null>(null)
  const [shareNewListOpen, setShareNewListOpen] = useState(false)
  const [shareNewListId, setShareNewListId] = useState<string | null>(null)
  const [shareNewListTitle, setShareNewListTitle] = useState('')
  const persistTimerRef = useRef<number | null>(null)

  const loggedIn = Boolean(user && isSupabaseConfigured())
  const isOwner = Boolean(user && ownerId && user.id === ownerId)

  useEffect(() => {
    negociosRef.current = negocios
  }, [negocios])

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
    if (!searchId || !isSupabaseConfigured()) {
      setLoading(false)
      return
    }
    if (user === undefined) return
    if (user === null) {
      setLoading(false)
      setNegocios([])
      setOwnerId(null)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      const sb = createBrowserSupabaseClient()
      const { data, error: err } = await fetchProspectSearch(sb, searchId)
      if (cancelled) return
      if (err || !data) {
        setError(err?.message ?? 'No se pudo cargar la búsqueda.')
        setNegocios([])
        setLoading(false)
        return
      }
      if (data.user_id === user.id) {
        router.replace(`/?search=${encodeURIComponent(searchId)}`)
        return
      }
      setOwnerId(data.user_id)
      setCategoria(data.categoria)
      setUbicacion(data.ubicacion)
      setRequestedQty(data.cantidad_solicitada)
      const raw = normalizeNegocios(data.negocios)
      const { map, error: markErr } = await fetchProspectMarksForSearch(sb, searchId)
      if (markErr) console.warn('[prospect marks]', markErr.message)
      setNegocios(mergeProspectMarksIntoNegocios(raw, map))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [searchId, user, router])

  const flushPersistTimer = () => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }
  }

  const scheduleCloudPersist = useCallback(
    (persistId: string) => {
      if (!isOwner || !user || !isSupabaseConfigured()) return
      flushPersistTimer()
      persistTimerRef.current = window.setTimeout(() => {
        persistTimerRef.current = null
        void updateProspectSearchProgress(createBrowserSupabaseClient(), persistId, negociosRef.current)
      }, 800)
    },
    [user, isOwner],
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
        if (isOwner && searchId && user && isSupabaseConfigured()) {
          window.setTimeout(() => {
            void updateProspectSearchProgress(createBrowserSupabaseClient(), searchId, next)
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
    [user, searchId, isOwner],
  )

  const confirmMarkProspect = useCallback(
    async (dest: MarkProspectDest) => {
      if (!user || !isSupabaseConfigured() || !searchId) return
      const row = markRow
      if (!row) return
      const listId = dest.kind === 'personal' ? null : dest.listId
      const sb = createBrowserSupabaseClient()
      const { id: pid, error: insErr } = await insertProspectFromSearch(sb, user.id, searchId, row, listId)
      if (insErr || !pid) {
        setError(formatClientProspectError(insErr?.message))
        return
      }
      setNegocios(prev => prev.map(r => (r.id === row.id ? { ...r, esProspecto: true, prospectRecordId: pid } : r)))
      if (isOwner) scheduleCloudPersist(searchId)
      setMarkRow(null)
      if (dest.kind === 'shared_new') {
        setShareNewListId(dest.listId)
        setShareNewListTitle(dest.name)
        setShareNewListOpen(true)
      }
    },
    [user, markRow, searchId, isOwner, scheduleCloudPersist],
  )

  const handleProspectToggle = useCallback(
    async (row: NegocioFila) => {
      if (!user || !isSupabaseConfigured() || !searchId) {
        setError('Inicia sesión para marcar prospectos.')
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
        if (isOwner) scheduleCloudPersist(searchId)
      } else {
        setMarkRow(row)
        setMarkDialogOpen(true)
      }
    },
    [user, searchId, scheduleCloudPersist, isOwner],
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
          if (isOwner && searchId && user && isSupabaseConfigured()) {
            void updateProspectSearchProgress(createBrowserSupabaseClient(), searchId, next)
          }
          return next
        })
      })()
    },
    [user, searchId, isOwner],
  )

  if (!searchId) {
    return (
      <div className="min-h-screen flex flex-col">
        <AppHeader />
        <main className="flex-1 p-6 text-sm text-neutral-600">Identificador de búsqueda no válido.</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-1">
              Búsqueda compartida
            </p>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {categoria || '…'} · {ubicacion || '…'}
            </h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl leading-relaxed">
              Vista solo de resultados: no forma parte de tu historial en Inicio. Elige lista personal o compartida al
              marcar con el corazón.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Link href="/carpetas" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
              ← Volver a carpetas
            </Link>
            <Link href="/" className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:underline">
              Ir a Inicio (nueva búsqueda)
            </Link>
          </div>
        </div>

        {!loggedIn && (
          <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            <Link href="/login" className="font-semibold underline">
              Inicia sesión
            </Link>{' '}
            para marcar filas como prospectos en tu lista.
          </p>
        )}

        {negocios.length > 0 && (
          <div className="flex justify-end">
            <ExportButton negocios={negocios} categoria={categoria} etiquetaUbicacion={ubicacion || 'Compartida'} />
          </div>
        )}

        <ResultsTable
          negocios={negocios}
          loading={loading}
          requestedQty={requestedQty}
          onEstadoChange={handleEstadoChange}
          detailHref={row =>
            row.prospectRecordId ? `/prospecto/${encodeURIComponent(row.prospectRecordId)}` : null
          }
          prospectHeart={
            loggedIn && searchId
              ? {
                  enabled: true,
                  disabled: loading,
                  onToggle: handleProspectToggle,
                }
              : undefined
          }
          deleteRow={
            loggedIn && searchId && isOwner
              ? {
                  enabled: true,
                  disabled: loading,
                  title: 'Eliminar esta fila de la búsqueda',
                  onDelete: handleDeleteNegocioRow,
                }
              : undefined
          }
        />
      </main>
      {error && <Toast message={error} onClose={() => setError(null)} />}

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
    </div>
  )
}

export default function BusquedaCompartidaPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">Cargando…</div>}
    >
      <BusquedaCompartidaInner />
    </Suspense>
  )
}
