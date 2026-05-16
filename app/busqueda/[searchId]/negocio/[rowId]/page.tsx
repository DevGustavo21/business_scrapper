'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { ProspectWorkspaceSidebar } from '@/components/ProspectWorkspaceSidebar'
import { Toast } from '@/components/Toast'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { fetchProspectSearch, updateProspectSearchProgress } from '@/lib/supabase/prospectSearches'
import {
  fetchClientProspectById,
  fetchProspectMarksForSearch,
  mergeProspectMarksIntoNegocios,
  updateClientProspectEstado,
  formatClientProspectError,
} from '@/lib/supabase/clientProspects'
import { insertEstadoChangedEvent, type WorkspaceThreadTarget } from '@/lib/supabase/prospectDetail'
import {
  upsertProspectBlacklist,
  removeProspectBlacklistByFingerprint,
} from '@/lib/supabase/prospectPipeline'
import { stableBusinessFingerprint } from '@/lib/businessDedupe'
import { normalizeNegocios } from '@/lib/negociosRows'
import { CONTACTO_ESTADOS, type ContactoEstado, type NegocioFila } from '@/types/business'

function safeReturnPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/'
  return next
}

function SearchNegocioDetailInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const searchId = typeof params.searchId === 'string' ? params.searchId : ''
  const rowId = typeof params.rowId === 'string' ? params.rowId : ''
  const backHref = safeReturnPath(searchParams.get('next'))

  const user = useSupabaseUser()
  const [row, setRow] = useState<NegocioFila | null>(null)
  const [categoria, setCategoria] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [allNegocios, setAllNegocios] = useState<NegocioFila[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workspaceTick, setWorkspaceTick] = useState(0)
  const [linkedListId, setLinkedListId] = useState<string | null>(null)
  const [linkedOwnerId, setLinkedOwnerId] = useState<string | null>(null)

  const loggedIn = Boolean(user && isSupabaseConfigured())

  const load = useCallback(async () => {
    if (!searchId || !rowId || !isSupabaseConfigured()) {
      setRow(null)
      setLoading(false)
      return
    }
    if (user === undefined) return
    if (user === null) {
      setRow(null)
      setAllNegocios([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const sb = createBrowserSupabaseClient()
    const { data, error: err } = await fetchProspectSearch(sb, searchId)
    if (err || !data) {
      setError(err?.message ?? 'No se pudo cargar la búsqueda.')
      setRow(null)
      setLoading(false)
      return
    }
    setCategoria(data.categoria)
    setUbicacion(data.ubicacion)
    const raw = normalizeNegocios(data.negocios)
    const { map, error: markErr } = await fetchProspectMarksForSearch(sb, searchId)
    if (markErr) console.warn('[prospect marks]', markErr.message)
    const merged = mergeProspectMarksIntoNegocios(raw, map)
    setAllNegocios(merged)
    const found = merged.find(r => r.id === rowId) ?? null
    setRow(found)
    if (!found) {
      setError('No se encontró esta fila en la búsqueda.')
    }
    setLoading(false)
  }, [searchId, rowId, user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!row?.prospectRecordId || !user || !isSupabaseConfigured()) {
      setLinkedListId(null)
      setLinkedOwnerId(null)
      return
    }
    const sb = createBrowserSupabaseClient()
    void fetchClientProspectById(sb, row.prospectRecordId).then(({ data }) => {
      if (data) {
        setLinkedListId(data.prospect_list_id)
        setLinkedOwnerId(data.user_id)
      }
    })
  }, [row?.prospectRecordId, user])

  const persistEstado = async (nextRow: NegocioFila, nextList: NegocioFila[]) => {
    if (!user || !isSupabaseConfigured() || !searchId) return
    const sb = createBrowserSupabaseClient()
    if (nextRow.prospectRecordId) {
      const { error: uErr } = await updateClientProspectEstado(sb, nextRow.prospectRecordId, nextRow.estado)
      if (uErr) {
        setError(formatClientProspectError(uErr.message))
        return
      }
    }
    const { error: pErr } = await updateProspectSearchProgress(sb, searchId, nextList)
    if (pErr) setError(pErr.message)
  }

  const logActivity = async (prevEstado: ContactoEstado, estado: ContactoEstado) => {
    if (!user || !isSupabaseConfigured() || !row) return
    const sb = createBrowserSupabaseClient()
    let target: WorkspaceThreadTarget
    if (row.prospectRecordId) {
      target = { kind: 'prospect', clientProspectId: row.prospectRecordId }
    } else {
      target = { kind: 'search_row', searchId, rowId }
    }
    const { error: actErr } = await insertEstadoChangedEvent(sb, user.id, prevEstado, estado, target)
    if (actErr) console.warn('[activity]', actErr.message)
    setWorkspaceTick(t => t + 1)
  }

  const handleEstado = async (estado: ContactoEstado) => {
    if (!row || !user || !isSupabaseConfigured()) return
    const prevEstado = row.estado
    const updated = { ...row, estado }
    const nextList = allNegocios.map(r => (r.id === row.id ? updated : r))
    setRow(updated)
    setAllNegocios(nextList)
    await persistEstado(updated, nextList)
    await logActivity(prevEstado, estado)

    const fp = stableBusinessFingerprint(row)
    const sb = createBrowserSupabaseClient()
    if (estado === 'No interesado' && prevEstado !== 'No interesado') {
      await upsertProspectBlacklist(sb, user.id, fp, row.nombre, row.prospectRecordId ?? null)
    } else if (prevEstado === 'No interesado' && estado !== 'No interesado') {
      await removeProspectBlacklistByFingerprint(sb, user.id, fp)
    }
  }

  const workspaceTarget: WorkspaceThreadTarget | null = row
    ? row.prospectRecordId
      ? { kind: 'prospect', clientProspectId: row.prospectRecordId }
      : { kind: 'search_row', searchId, rowId }
    : null

  if (!searchId || !rowId) {
    return (
      <div className="min-h-screen flex flex-col">
        <AppHeader />
        <main className="flex-1 p-6 text-sm text-neutral-600">Enlace no válido.</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <Link
              href={backHref}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              ← Volver a resultados
            </Link>
            <p className="text-xs text-neutral-500">
              {categoria} · {ubicacion}
            </p>
          </div>
          {!loggedIn && (
            <p className="text-sm text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
              <Link href="/login" className="underline font-semibold">
                Inicia sesión
              </Link>{' '}
              para guardar cambios y usar el panel de colaboración.
            </p>
          )}
          {loading && <p className="text-sm text-neutral-500">Cargando…</p>}
          {!loading && error && !row && <p className="text-sm text-red-600">{error}</p>}
          {row && (
            <>
              {row.prospectRecordId && (
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  También en{' '}
                  <Link
                    href={`/prospecto/${encodeURIComponent(row.prospectRecordId)}`}
                    className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    ficha de prospecto
                  </Link>{' '}
                  (mismo hilo si está vinculado a ese registro).
                </p>
              )}
              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-950/40">
                <div className="aspect-[21/9] max-h-[220px] bg-gradient-to-br from-indigo-100 to-neutral-100 dark:from-indigo-950 dark:to-neutral-900 flex items-end p-6">
                  <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">{row.nombre}</h1>
                </div>
                <div className="p-6 grid sm:grid-cols-2 gap-4 text-sm">
                  {(
                    [
                      ['Dirección', row.direccion],
                      ['Ciudad', row.ciudad],
                      ['País', row.pais],
                      ['Teléfono', row.telefono],
                      ['Correo', row.correo],
                      ['Sitio web', row.sitioWeb],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs font-semibold uppercase text-neutral-500">{k}</p>
                      <p className="text-neutral-900 dark:text-neutral-100 mt-0.5 whitespace-pre-wrap">{v || '—'}</p>
                    </div>
                  ))}
                </div>
                <div className="px-6 pb-6 grid gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500">Problemas detectados</p>
                    <p className="mt-1 text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap text-sm">
                      {row.problemasDetectados || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500">Oportunidades</p>
                    <p className="mt-1 text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap text-sm">
                      {row.oportunidades || '—'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-neutral-500">Estado del proceso</label>
                    <select
                      value={row.estado}
                      onChange={e => void handleEstado(e.target.value as ContactoEstado)}
                      disabled={!loggedIn}
                      className="mt-2 max-w-xs block rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm disabled:opacity-50"
                    >
                      {CONTACTO_ESTADOS.map(s => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {row && workspaceTarget && (
          <ProspectWorkspaceSidebar
            target={workspaceTarget}
            prospectListId={row.prospectRecordId ? linkedListId : null}
            prospectOwnerId={row.prospectRecordId ? linkedOwnerId : null}
            userId={user?.id ?? null}
            loggedIn={loggedIn}
            refreshKey={workspaceTick}
            onError={setError}
          />
        )}
      </div>
      {error && row && <Toast message={error} onClose={() => setError(null)} />}
    </div>
  )
}

export default function SearchNegocioDetailPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">Cargando…</div>}
    >
      <SearchNegocioDetailInner />
    </Suspense>
  )
}
