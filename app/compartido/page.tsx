'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { Toast } from '@/components/Toast'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import {
  acceptCollaborationInviteRpc,
  declineCollaborationInviteRpc,
  listPendingInvitesForMe,
  normalizeShareEmail,
} from '@/lib/supabase/collaboration'
import type { CollaborationInviteRow } from '@/types/collaboration'

function resourceLabel(t: CollaborationInviteRow['resource_type']): string {
  switch (t) {
    case 'search_folder':
      return 'Carpeta de búsquedas'
    case 'prospect_search':
      return 'Búsqueda'
    case 'prospect_list':
      return 'Lista de prospectos'
    default:
      return 'Recurso'
  }
}

function CompartidoInner() {
  const user = useSupabaseUser()
  const [invites, setInvites] = useState<CollaborationInviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loggedIn = Boolean(user && isSupabaseConfigured())

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setInvites([])
      setLoading(false)
      return
    }
    setLoading(true)
    const sb = createBrowserSupabaseClient()
    const { data, error: err } = await listPendingInvitesForMe(sb)
    if (err) setError(err.message)
    else {
      setError(null)
      const pending = (data ?? []).filter(i => {
        if (i.status !== 'pending') return false
        if (i.invited_by === user.id) return false
        if (i.invitee_user_id === user.id) return true
        if (!user.email) return false
        return normalizeShareEmail(user.email) === normalizeShareEmail(i.invitee_email)
      })
      setInvites(pending)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const accept = async (id: string) => {
    setBusyId(id)
    const sb = createBrowserSupabaseClient()
    const { ok, error: err } = await acceptCollaborationInviteRpc(sb, id)
    setBusyId(null)
    if (!ok || err) setError(err?.message ?? 'No se pudo aceptar.')
    else await load()
  }

  const decline = async (id: string) => {
    setBusyId(id)
    const sb = createBrowserSupabaseClient()
    const { ok, error: err } = await declineCollaborationInviteRpc(sb, id)
    setBusyId(null)
    if (!ok || err) setError(err?.message ?? 'No se pudo rechazar.')
    else await load()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Invitaciones pendientes</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Aquí aparecen las invitaciones enviadas a tu correo. También puedes aceptarlas desde la{' '}
            <strong>campana</strong> del menú superior.
          </p>
        </div>

        {!loggedIn && (
          <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 rounded-xl px-4 py-3">
            <Link href="/login" className="font-semibold underline">
              Inicia sesión
            </Link>{' '}
            para ver invitaciones asociadas a tu cuenta.
          </p>
        )}

        {loggedIn && loading && <p className="text-sm text-neutral-500">Cargando…</p>}

        {loggedIn && !loading && invites.length === 0 && (
          <p className="text-sm text-neutral-500 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-8 text-center">
            No tienes invitaciones pendientes.
          </p>
        )}

        {loggedIn && !loading && invites.length > 0 && (
          <ul className="flex flex-col gap-3">
            {invites.map(inv => (
              <li
                key={inv.id}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 p-4 flex flex-col gap-3"
              >
                <div>
                  <span className="text-xs font-semibold uppercase text-neutral-500">{resourceLabel(inv.resource_type)}</span>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mt-1">
                    Invitación para compartir este recurso contigo.
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Rol ofrecido: {inv.role === 'editor' ? 'Editor' : 'Solo lectura'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === inv.id}
                    onClick={() => void accept(inv.id)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    Aceptar
                  </button>
                  <button
                    type="button"
                    disabled={busyId === inv.id}
                    onClick={() => void decline(inv.id)}
                    className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                  <Link href="/carpetas" className="px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                    Carpetas
                  </Link>
                  <Link href="/listas-prospectos" className="px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                    Listas
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      {error && <Toast message={error} onClose={() => setError(null)} />}
    </div>
  )
}

export default function CompartidoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">Cargando…</div>}>
      <CompartidoInner />
    </Suspense>
  )
}
