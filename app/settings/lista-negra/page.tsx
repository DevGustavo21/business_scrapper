'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { Toast } from '@/components/Toast'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import {
  listProspectBlacklist,
  removeProspectBlacklistById,
  syncContactEstadoAfterBlacklistRemoval,
  type ProspectBlacklistRow,
} from '@/lib/supabase/prospectPipeline'

function ListaNegraInner() {
  const user = useSupabaseUser()
  const [rows, setRows] = useState<ProspectBlacklistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loggedIn = Boolean(user && isSupabaseConfigured())

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const sb = createBrowserSupabaseClient()
    const { data, error: err } = await listProspectBlacklist(sb)
    if (err) setError(err.message)
    else {
      setError(null)
      setRows(data ?? [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const removeOne = async (r: ProspectBlacklistRow) => {
    if (!user || !isSupabaseConfigured()) return
    if (!window.confirm(`¿Quitar «${r.nombre || r.fingerprint.slice(0, 40)}» de la lista exclusiones? Podría volver a salir en búsquedas.`))
      return
    const sb = createBrowserSupabaseClient()
    const { error: dErr } = await removeProspectBlacklistById(sb, r.id)
    if (dErr) {
      setError(dErr.message)
      return
    }
    const { error: syncErr } = await syncContactEstadoAfterBlacklistRemoval(sb, user.id, {
      fingerprint: r.fingerprint,
      client_prospect_id: r.client_prospect_id,
    })
    if (syncErr) setError(syncErr.message)
    await load()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-400">Configuración</p>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Lista negra</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Negocios marcados como <strong>No interesado</strong> u otros que hayas bloqueado. No aparecerán en nuevas
            búsquedas del mismo rubro y ubicación. Al quitarlos aquí pueden volver a mostrarse si coinciden otra vez en el
            scraping.
          </p>
        </div>
        <Link href="/" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline w-fit">
          ← Inicio
        </Link>

        {!loggedIn && (
          <p className="text-sm text-amber-800 dark:text-amber-200 border border-amber-200 rounded-xl px-4 py-3">
            <Link href="/login" className="underline font-semibold">
              Inicia sesión
            </Link>{' '}
            para ver tu lista negra.
          </p>
        )}

        {loggedIn && loading && <p className="text-sm text-neutral-500">Cargando…</p>}
        {loggedIn && !loading && rows.length === 0 && (
          <p className="text-sm text-neutral-500 border rounded-xl px-4 py-8 text-center">No hay exclusiones activas.</p>
        )}
        {loggedIn && !loading && rows.length > 0 && (
          <ul className="flex flex-col gap-2">
            {rows.map(r => (
              <li
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-neutral-200 dark:border-neutral-800 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">{r.nombre || 'Sin nombre'}</p>
                  <p className="text-[11px] text-neutral-500 font-mono truncate" title={r.fingerprint}>
                    {r.fingerprint}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeOne(r)}
                  className="shrink-0 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Quitar de lista negra
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
      {error && <Toast message={error} onClose={() => setError(null)} />}
    </div>
  )
}

export default function ListaNegraPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm">Cargando…</div>}>
      <ListaNegraInner />
    </Suspense>
  )
}
