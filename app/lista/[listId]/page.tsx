'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { ResultsTable } from '@/components/ResultsTable'
import { ExportButton } from '@/components/ExportButton'
import { Toast } from '@/components/Toast'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import {
  listClientProspectsForList,
  deleteClientProspectById,
  clientProspectRowToNegocioFila,
  updateClientProspectEstado,
  formatClientProspectError,
} from '@/lib/supabase/clientProspects'
import { listProspectListsForUser } from '@/lib/supabase/collaboration'
import { stableBusinessFingerprint } from '@/lib/businessDedupe'
import {
  upsertProspectBlacklist,
  removeProspectBlacklistByFingerprint,
} from '@/lib/supabase/prospectPipeline'
import type { ContactoEstado, NegocioFila } from '@/types/business'
import type { ClientProspectRow } from '@/types/client-prospect'
import type { ProspectListRow } from '@/types/collaboration'

function ListaDetalleInner() {
  const params = useParams()
  const listId = typeof params.listId === 'string' ? params.listId : ''
  const user = useSupabaseUser()

  const [rows, setRows] = useState<ClientProspectRow[]>([])
  const [meta, setMeta] = useState<ProspectListRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loggedIn = Boolean(user && isSupabaseConfigured())

  useEffect(() => {
    if (!listId || !isSupabaseConfigured()) {
      setRows([])
      setMeta(null)
      setLoading(false)
      return
    }
    if (user === undefined) return
    if (user === null) {
      setRows([])
      setMeta(null)
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      const sb = createBrowserSupabaseClient()
      const [lr, pr] = await Promise.all([
        listProspectListsForUser(sb, user.id),
        listClientProspectsForList(sb, listId),
      ])
      if (cancelled) return
      const list = lr.data?.find(l => l.id === listId) ?? null
      setMeta(list)
      if (pr.error) setError(formatClientProspectError(pr.error.message))
      else setError(null)
      setRows(pr.data ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [listId, user])

  const negocios: NegocioFila[] = useMemo(
    () =>
      rows.map(r => ({
        ...clientProspectRowToNegocioFila(r),
        prospectSource: r.source,
      })),
    [rows],
  )

  const isShared = Boolean(meta && user && meta.owner_id !== user.id)

  const deleteProspectById = async (id: string) => {
    if (!user || !isSupabaseConfigured()) return
    const sb = createBrowserSupabaseClient()
    const { error: dErr } = await deleteClientProspectById(sb, id)
    if (dErr) setError(formatClientProspectError(dErr.message))
    else {
      setRows(prev => prev.filter(r => r.id !== id))
    }
  }

  const requestDeleteProspect = (row: NegocioFila) => {
    if (
      !window.confirm(
        `¿Eliminar por completo «${row.nombre}»? Esta acción no se puede deshacer.`,
      )
    )
      return
    void deleteProspectById(row.id)
  }

  const handleEstadoChange = async (id: string, estado: ContactoEstado) => {
    if (!user || !isSupabaseConfigured()) return
    const prevRow = rows.find(r => r.id === id)
    const prevEstado = prevRow?.estado as ContactoEstado | undefined
    const sb = createBrowserSupabaseClient()
    const { error: uErr } = await updateClientProspectEstado(sb, id, estado)
    if (uErr) setError(formatClientProspectError(uErr.message))
    else setRows(prev => prev.map(r => (r.id === id ? { ...r, estado } : r)))
    if (prevRow && prevEstado !== estado) {
      const fp = stableBusinessFingerprint({
        nombre: prevRow.nombre,
        telefono: prevRow.telefono,
        correo: prevRow.correo,
        direccion: prevRow.direccion,
      })
      if (estado === 'No interesado') {
        await upsertProspectBlacklist(sb, user.id, fp, prevRow.nombre, id)
      } else if (prevEstado === 'No interesado') {
        await removeProspectBlacklistByFingerprint(sb, user.id, fp)
      }
    }
  }

  if (!listId) {
    return (
      <div className="min-h-screen flex flex-col">
        <AppHeader />
        <main className="flex-1 p-6 text-sm text-neutral-600">Lista no válida.</main>
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
              Lista de prospectos
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              {meta?.name ?? (loading ? 'Cargando…' : 'Lista')}
            </h1>
            {isShared && (
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-200/90">
                Lista compartida contigo: aquí solo ves los datos de esta lista, no el formulario de búsqueda del inicio.
              </p>
            )}
            {!isShared && meta && (
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
                Prospectos asignados a esta lista (desde búsquedas o alta manual). Para gestionar el nombre o permisos, ve
                a{' '}
                <Link href="/clientes-prospectos" className="text-indigo-600 dark:text-indigo-400 font-medium">
                  Listas de prospectos
                </Link>
                .
              </p>
            )}
            {!loading && !meta && loggedIn && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                No tienes acceso a esta lista o no existe.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0 text-sm">
            <Link href="/clientes-prospectos" className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
              ← Listas
            </Link>
            <Link href="/clientes-prospectos" className="text-neutral-600 dark:text-neutral-400 hover:underline">
              Todos los prospectos
            </Link>
          </div>
        </div>

        {!loggedIn && (
          <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            <Link href="/login" className="font-semibold underline">
              Inicia sesión
            </Link>{' '}
            para ver esta lista.
          </p>
        )}

        {loggedIn && meta && negocios.length > 0 && (
          <div className="flex justify-end">
            <ExportButton
              negocios={negocios}
              categoria={meta.name}
              etiquetaUbicacion="Lista de prospectos"
            />
          </div>
        )}

        <ResultsTable
          negocios={negocios}
          loading={loading}
          onEstadoChange={handleEstadoChange}
          summaryMode="list"
          showOrigenColumn
          detailHref={row => `/prospecto/${encodeURIComponent(row.id)}`}
          deleteRow={
            loggedIn && meta
              ? {
                  enabled: true,
                  disabled: loading,
                  title: 'Eliminar este prospecto',
                  onDelete: requestDeleteProspect,
                }
              : undefined
          }
        />

        {!loading && loggedIn && meta && rows.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Esta lista aún no tiene prospectos. Quien tenga permiso de edición puede añadirlos desde la búsqueda (corazón) o
            desde «Agregar prospectos».
          </p>
        )}
      </main>
      {error && <Toast message={error} onClose={() => setError(null)} />}
    </div>
  )
}

export default function ListaDetallePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">Cargando…</div>
      }
    >
      <ListaDetalleInner />
    </Suspense>
  )
}
