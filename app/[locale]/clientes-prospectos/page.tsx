'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { AppHeader } from '@/components/AppHeader'
import { ResultsTable } from '@/components/ResultsTable'
import { ExportButton } from '@/components/ExportButton'
import { Toast } from '@/components/Toast'
import { ShareResourceDialog } from '@/components/ShareResourceDialog'
import { SharedListMembersDialog } from '@/components/SharedListMembersDialog'
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
import { countProspectListCollaborators, listProspectListsForUser } from '@/lib/supabase/collaboration'
import { stableBusinessFingerprint } from '@/lib/businessDedupe'
import {
  upsertProspectBlacklist,
  removeProspectBlacklistByFingerprint,
} from '@/lib/supabase/prospectPipeline'
import type { ContactoEstado, NegocioFila } from '@/types/business'
import type { ClientProspectRow } from '@/types/client-prospect'
import type { ProspectListRow } from '@/types/collaboration'

function ClientesProspectosInner() {
  const t = useTranslations('clientProspects')
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
  const [sharedMembersOpen, setSharedMembersOpen] = useState(false)
  const [collaboratorCount, setCollaboratorCount] = useState(0)

  const loggedIn = Boolean(user && isSupabaseConfigured())

  const selectedList = useMemo(
    () => (listFilter !== 'all' && listFilter !== 'none' ? lists.find(l => l.id === listFilter) ?? null : null),
    [lists, listFilter],
  )
  const canShareSelectedList = Boolean(
    loggedIn && user && selectedList && selectedList.owner_id === user.id,
  )
  const showSharedWith = Boolean(canShareSelectedList && collaboratorCount > 0)

  useEffect(() => {
    if (!canShareSelectedList || !selectedList || !isSupabaseConfigured()) {
      setCollaboratorCount(0)
      return
    }
    const sb = createBrowserSupabaseClient()
    void countProspectListCollaborators(sb, selectedList.id).then(({ count }) => setCollaboratorCount(count))
  }, [canShareSelectedList, selectedList?.id])

  useEffect(() => {
    if (listaFromUrl) {
      router.replace({
        pathname: '/lista/[listId]',
        params: { listId: listaFromUrl },
      })
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
    if (!window.confirm(t('deleteConfirm', { name: row.nombre })))
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
      ? t('showingAll')
      : listFilter === 'none'
        ? t('showingNone')
        : t('showingList', { name: listNameById.get(listFilter) ?? listFilter })

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">{t('title')}</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            {t('description')}
            {/* Links principales conservados para navegación rápida. */}
            {' '}
            <Link href="/" className="text-indigo-600 dark:text-indigo-400 font-medium">
              {t('searchLink')}
            </Link>{' '}
            ·{' '}
            <Link href="/agregar-prospectos" className="text-indigo-600 dark:text-indigo-400 font-medium">
              {t('addProspectsLink')}
            </Link>
          </p>
        </div>

        {!loggedIn && (
          <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            <Link href="/login" className="font-semibold underline">
              {t('loginPrefix')}
            </Link>{' '}
            {t('loginSuffix')}
          </p>
        )}

        {loggedIn && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 px-4 py-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 min-w-[220px]">
              {t('filterByList')}
              <select
                value={listFilter}
                onChange={e => setListFilter(e.target.value)}
                className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
              >
                <option value="all">{t('all')}</option>
                <option value="none">{t('none')}</option>
                {lists.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
              <p className="text-xs text-neutral-500 flex-1">{filterHint}</p>
              {showSharedWith && selectedList && user && (
                <button
                  type="button"
                  onClick={() => setSharedMembersOpen(true)}
                  className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold border border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {t('sharedWith', { count: collaboratorCount })}
                </button>
              )}
              {canShareSelectedList && selectedList && (
                <button
                  type="button"
                  onClick={() => setShareListOpen(true)}
                  className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  {t('shareThisList')}
                </button>
              )}
            </div>
          </div>
        )}

        {loggedIn && negocios.length > 0 && (
          <div className="flex justify-end">
          <ExportButton negocios={negocios} categoria={t('exportCategory')} etiquetaUbicacion={t('exportLocation')} />
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
                  title: t('deleteTitle'),
                  onDelete: requestDeleteProspect,
                }
              : undefined
          }
        />

        {!loading && loggedIn && filteredRows.length === 0 && rows.length > 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('filteredEmpty')}
          </p>
        )}

        {!loading && loggedIn && rows.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('empty')}
          </p>
        )}
      </main>

      {error && <Toast message={error} onClose={() => setError(null)} />}

      {loggedIn && shareListOpen && selectedList && user && (
        <ShareResourceDialog
          open={shareListOpen}
          onClose={() => {
            setShareListOpen(false)
            void load()
          }}
          title={selectedList.name}
          resourceType="prospect_list"
          resourceId={selectedList.id}
          inviterUserId={user.id}
          inviterEmail={user.email ?? undefined}
        />
      )}

      {loggedIn && sharedMembersOpen && selectedList && user && (
        <SharedListMembersDialog
          open={sharedMembersOpen}
          onClose={() => {
            setSharedMembersOpen(false)
            if (selectedList) {
              const sb = createBrowserSupabaseClient()
              void countProspectListCollaborators(sb, selectedList.id).then(({ count }) =>
                setCollaboratorCount(count),
              )
            }
          }}
          listId={selectedList.id}
          listName={selectedList.name}
          ownerId={user.id}
        />
      )}
    </div>
  )
}

export default function ClientesProspectosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">Loading…</div>
      }
    >
      <ClientesProspectosInner />
    </Suspense>
  )
}
