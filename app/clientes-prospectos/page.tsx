'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { ResultsTable } from '@/components/ResultsTable'
import { ExportButton } from '@/components/ExportButton'
import { Toast } from '@/components/Toast'
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
import type { ContactoEstado, NegocioFila } from '@/types/business'
import type { ClientProspectRow } from '@/types/client-prospect'

export default function ClientesProspectosPage() {
  const user = useSupabaseUser()
  const [rows, setRows] = useState<ClientProspectRow[]>([])
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
    const { data, error: err } = await listAllClientProspects(sb)
    if (err) setError(formatClientProspectError(err.message))
    else setError(null)
    setRows(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const negocios: NegocioFila[] = rows.map(r => ({
    ...clientProspectRowToNegocioFila(r),
    prospectSource: r.source,
  }))

  const handleRemove = async (row: NegocioFila) => {
    if (!window.confirm('¿Quitar este negocio de clientes prospectos?')) return
    if (!user || !isSupabaseConfigured()) return
    const sb = createBrowserSupabaseClient()
    const { error: dErr } = await deleteClientProspectById(sb, row.id)
    if (dErr) setError(formatClientProspectError(dErr.message))
    else await load()
  }

  const handleEstadoChange = async (id: string, estado: ContactoEstado) => {
    if (!user || !isSupabaseConfigured()) return
    const sb = createBrowserSupabaseClient()
    const { error: uErr } = await updateClientProspectEstado(sb, id, estado)
    if (uErr) setError(formatClientProspectError(uErr.message))
    else await load()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">Clientes prospectos</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            Listado unificado: marcas con el corazón desde la{' '}
            <Link href="/" className="text-indigo-600 dark:text-indigo-400 font-medium">
              búsqueda
            </Link>{' '}
            y altas desde{' '}
            <Link href="/agregar-prospectos" className="text-indigo-600 dark:text-indigo-400 font-medium">
              Agregar prospectos
            </Link>
            . Pulsa el corazón para quitar de esta lista.
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
          prospectHeart={
            loggedIn
              ? {
                  enabled: true,
                  disabled: loading,
                  removeOnly: true,
                  onToggle: row => void handleRemove(row),
                }
              : undefined
          }
        />

        {!loading && loggedIn && rows.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Aún no hay prospectos. Márcalos con el corazón en los resultados de una búsqueda o créalos en Agregar prospectos.
          </p>
        )}
      </main>

      {error && <Toast message={error} onClose={() => setError(null)} />}
    </div>
  )
}
