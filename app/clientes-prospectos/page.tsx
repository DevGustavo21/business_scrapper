'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { ResultsTable } from '@/components/ResultsTable'
import { ExportButton } from '@/components/ExportButton'
import { Toast } from '@/components/Toast'
import { ShareResourceDialog } from '@/components/ShareResourceDialog'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import {
  listAllClientProspects,
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

function ClientesProspectosInner() {
  const user = useSupabaseUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const listaFromUrl = searchParams.get('lista')

  const [rows, setRows] = useState<ClientProspectRow[]>([])
  const [lists, setLists] = useState<ProspectListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [listFilter, setListFilter] = useState<string>('all')
  const [shareListOpen, setShareListOpen] = useState(false)

  const loggedIn = Boolean(user && isSupabaseConfigured())

  const selectedList = useMemo(
    () => (listFilter !== 'all' && listFilter !== 'none' ? lists.find(l => l.id === listFilter) ?? null : null),
    [lists, listFilter],
  )
  const canShareSelectedList = Boolean(
    loggedIn && user && selectedList && selectedList.owner_id === user.id,
  )

  useEffect(() => {
    if (listaFromUrl) {
      router.replace(`/lista/${encodeURIComponent(listaFromUrl)}`)
    }
  }, [listaFromUrl, router])

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const sb = createBrowserSupabaseClient()
    const [{ data, error: err }, lr] = await Promise.all([
      listAllClientProspects(sb),
      listProspectListsForUser(sb, user.id),
    ])
    if (lr.data) setLists(lr.data)
    if (err) setError(formatClientProspectError(err.message))
    else setError(null)
    setRows(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const listNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of lists) m.set(l.id, l.name)
    return m
  }, [lists])

  const filteredRows = useMemo(() => {
    if (listFilter === 'all') return rows
    if (listFilter === 'none') return rows.filter(r => !r.prospect_list_id)
    return rows.filter(r => r.prospect_list_id === listFilter)
  }, [rows, listFilter])

  const negocios: NegocioFila[] = filteredRows.map(r => ({
    ...clientProspectRowToNegocioFila(r),
    prospectSource: r.source,
  }))

  const deleteProspectById = async (id: string) => {
    if (!user || !isSupabaseConfigured()) return
    const sb = createBrowserSupabaseClient()
    const { error: dErr } = await deleteClientProspectById(sb, id)
    if (dErr) setError(formatClientProspectError(dErr.message))
    else await load()
  }

  const requestDeleteProspect = (row: NegocioFila) => {
    if (!window.confirm(`¿Eliminar por completo «${row.nombre}» de clientes prospectos? Esta acción no se puede deshacer.`))
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
    else setError(null)
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
    await load()
  }

  const filterHint =
    listFilter === 'all'
      ? 'Mostrando todos los accesibles'
      : listFilter === 'none'
        ? 'Solo prospectos sin lista'
        : `Lista: ${listNameById.get(listFilter) ?? listFilter}`

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">Clientes prospectos</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            Listado unificado (personales y compartidos por lista). Marca desde la{' '}
            <Link href="/" className="text-indigo-600 dark:text-indigo-400 font-medium">
              búsqueda
            </Link>{' '}
            o alta en{' '}
            <Link href="/agregar-prospectos" className="text-indigo-600 dark:text-indigo-400 font-medium">
              Agregar prospectos
            </Link>
            . Las listas compartidas se crean o eligen al dar «me gusta» a un resultado en la{' '}
            <Link href="/" className="text-indigo-600 dark:text-indigo-400 font-medium">
              búsqueda
            </Link>
            . Si eres <strong>dueño</strong> de una lista, selecciónala en el filtro y usa{' '}
            <strong>Compartir esta lista</strong> para invitar a tu equipo.
          </p>
        </div>

        {!loggedIn && (
          <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            <Link href="/login" className="font-semibold underline">
              Inicia sesión
            </Link>{' '}
            para ver tus prospectos guardados.
          </p>
        )}

        {loggedIn && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 px-4 py-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 min-w-[220px]">
              Filtrar por lista
              <select
                value={listFilter}
                onChange={e => setListFilter(e.target.value)}
                className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
              >
                <option value="all">Todas</option>
                <option value="none">Sin lista (personal)</option>
                {lists.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
              <p className="text-xs text-neutral-500 flex-1">{filterHint}</p>
              {canShareSelectedList && selectedList && (
                <button
                  type="button"
                  onClick={() => setShareListOpen(true)}
                  className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Compartir esta lista
                </button>
              )}
            </div>
          </div>
        )}

        {loggedIn && negocios.length > 0 && (
          <div className="flex justify-end">
            <ExportButton negocios={negocios} categoria="Clientes prospectos" etiquetaUbicacion="Lista exportada" />
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
            loggedIn
              ? {
                  enabled: true,
                  disabled: loading,
                  title: 'Eliminar este prospecto de forma permanente',
                  onDelete: requestDeleteProspect,
                }
              : undefined
          }
        />

        {!loading && loggedIn && filteredRows.length === 0 && rows.length > 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No hay prospectos con este filtro. Cambia la lista en el selector superior.
          </p>
        )}

        {!loading && loggedIn && rows.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Aún no hay prospectos. Márcalos con el corazón en los resultados de una búsqueda o créalos en Agregar prospectos.
          </p>
        )}
      </main>

      {error && <Toast message={error} onClose={() => setError(null)} />}

      {loggedIn && shareListOpen && selectedList && user && (
        <ShareResourceDialog
          open={shareListOpen}
          onClose={() => setShareListOpen(false)}
          title={selectedList.name}
          resourceType="prospect_list"
          resourceId={selectedList.id}
          inviterUserId={user.id}
          inviterEmail={user.email ?? undefined}
        />
      )}
    </div>
  )
}

export default function ClientesProspectosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">Cargando…</div>
      }
    >
      <ClientesProspectosInner />
    </Suspense>
  )
}
