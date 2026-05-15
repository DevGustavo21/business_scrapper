'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ListTodo, Share2, Trash2 } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { ShareResourceDialog } from '@/components/ShareResourceDialog'
import { Toast } from '@/components/Toast'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import {
  createProspectList,
  deleteProspectList,
  listProspectListsForUser,
  renameProspectList,
} from '@/lib/supabase/collaboration'
import type { ProspectListRow } from '@/types/collaboration'

function ListasProspectosInner() {
  const user = useSupabaseUser()
  const [lists, setLists] = useState<ProspectListRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [rename, setRename] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [listAbility, setListAbility] = useState<'owner' | 'editor' | 'viewer'>('viewer')

  const loggedIn = Boolean(user && isSupabaseConfigured())

  const selected = useMemo(() => lists.find(l => l.id === selectedId) ?? null, [lists, selectedId])
  const isOwner = Boolean(selected && user && selected.owner_id === user.id)
  const canEditList = listAbility === 'owner' || listAbility === 'editor'

  useEffect(() => {
    if (!selected || !user) return
    if (selected.owner_id === user.id) {
      setListAbility('owner')
      return
    }
    const sb = createBrowserSupabaseClient()
    void sb
      .from('collaboration_members')
      .select('role')
      .eq('resource_type', 'prospect_list')
      .eq('resource_id', selected.id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setListAbility(data?.role === 'editor' ? 'editor' : 'viewer')
      })
  }, [selected, user])

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setLists([])
      setLoading(false)
      return
    }
    setLoading(true)
    const sb = createBrowserSupabaseClient()
    const { data, error: err } = await listProspectListsForUser(sb, user.id)
    if (err) setError(err.message)
    else {
      setError(null)
      setLists(data)
      setSelectedId(prev => {
        if (prev && data.some(l => l.id === prev)) return prev
        return data[0]?.id ?? null
      })
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (selected) setRename(selected.name)
  }, [selected])

  const handleCreate = async () => {
    if (!user || !newName.trim()) return
    const sb = createBrowserSupabaseClient()
    const { list, error: err } = await createProspectList(sb, user.id, newName.trim())
    if (err || !list) setError(err?.message ?? 'Error')
    else {
      setNewName('')
      await load()
      setSelectedId(list.id)
    }
  }

  const handleRename = async () => {
    if (!selectedId || !rename.trim() || !canEditList) return
    const sb = createBrowserSupabaseClient()
    const { error: err } = await renameProspectList(sb, selectedId, rename.trim())
    if (err) setError(err.message)
    else await load()
  }

  const handleDelete = async () => {
    if (!selectedId || !isOwner) return
    if (!window.confirm('¿Eliminar esta lista? Los prospectos pasarán a «sin lista» (no se borran).')) return
    const sb = createBrowserSupabaseClient()
    const { error: err } = await deleteProspectList(sb, selectedId)
    if (err) setError(err.message)
    else {
      setSelectedId(null)
      await load()
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <ListTodo className="text-indigo-600" />
              Listas de prospectos
            </h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
              Crea listas con nombre propio, guarda prospectos en ellas desde la búsqueda o desde «Agregar prospectos», y comparte la lista por correo con lectura o edición.
            </p>
          </div>
          <Link
            href="/clientes-prospectos"
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
          >
            Ver todos los prospectos →
          </Link>
        </div>

        {!loggedIn && (
          <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            <Link href="/login" className="font-semibold underline">
              Inicia sesión
            </Link>{' '}
            para gestionar listas.
          </p>
        )}

        {loggedIn && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-4 flex flex-col gap-3 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-neutral-50/50 dark:bg-neutral-950/40">
              <span className="text-xs font-semibold uppercase text-neutral-500">Listas</span>
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Nombre de lista…"
                  className="flex-1 min-w-0 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={loading || !newName.trim()}
                  className="shrink-0 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40"
                >
                  Crear
                </button>
              </div>
              <div className="flex flex-col gap-1 max-h-[360px] overflow-y-auto">
                {loading && <p className="text-xs text-neutral-500">Cargando…</p>}
                {!loading && lists.length === 0 && (
                  <p className="text-xs text-neutral-500">Crea tu primera lista.</p>
                )}
                {lists.map(l => {
                  const active = l.id === selectedId
                  const mine = user?.id === l.owner_id
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedId(l.id)}
                      className={`text-left rounded-lg px-3 py-2 text-sm border transition-colors ${
                        active
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                          : 'border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800/80'
                      }`}
                    >
                      <span className="font-medium line-clamp-2">{l.name}</span>
                      <span className="block text-[10px] text-neutral-500">{mine ? 'Propietario' : 'Compartida'}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="lg:col-span-8 flex flex-col gap-4 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 min-h-[280px]">
              {!selected && <p className="text-sm text-neutral-500">Selecciona una lista.</p>}
              {selected && (
                <>
                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Nombre</label>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        value={rename}
                        onChange={e => setRename(e.target.value)}
                        disabled={!canEditList}
                        className="flex-1 min-w-[200px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm disabled:opacity-50"
                      />
                      {canEditList && (
                        <button type="button" onClick={handleRename} className="px-3 py-2 rounded-lg border text-sm">
                          Guardar nombre
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canEditList && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShareOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium"
                        >
                          <Share2 size={16} />
                          Compartir lista
                        </button>
                      </>
                    )}
                    <Link
                      href={`/clientes-prospectos?lista=${encodeURIComponent(selected.id)}`}
                      className="inline-flex items-center px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium"
                    >
                      Ver prospectos en esta lista
                    </Link>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm"
                      >
                        <Trash2 size={16} />
                        Eliminar lista
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    En la página de inicio elige esta lista en «Lista al marcar prospectos» antes de usar el corazón; en «Agregar prospectos» también puedes elegir destino.
                  </p>
                </>
              )}
            </section>
          </div>
        )}
      </main>

      {selected && user && (
        <ShareResourceDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          title={selected.name}
          resourceType="prospect_list"
          resourceId={selected.id}
          inviterUserId={user.id}
          inviterEmail={user.email ?? undefined}
        />
      )}
      {error && <Toast message={error} onClose={() => setError(null)} />}
    </div>
  )
}

export default function ListasProspectosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">Cargando…</div>}>
      <ListasProspectosInner />
    </Suspense>
  )
}
