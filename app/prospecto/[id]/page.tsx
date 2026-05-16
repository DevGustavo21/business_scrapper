'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { Toast } from '@/components/Toast'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import {
  fetchClientProspectById,
  clientProspectRowToNegocioFila,
  updateClientProspectEstado,
  formatClientProspectError,
} from '@/lib/supabase/clientProspects'
import {
  listThreadMessages,
  insertThreadMessage,
  listProspectTasks,
  insertProspectTask,
  updateProspectTaskDone,
} from '@/lib/supabase/prospectDetail'
import type { ProspectThreadMessageRow, ProspectTaskRow } from '@/lib/supabase/prospectDetail'
import {
  upsertProspectBlacklist,
  removeProspectBlacklistByFingerprint,
} from '@/lib/supabase/prospectPipeline'
import { stableBusinessFingerprint } from '@/lib/businessDedupe'
import { CONTACTO_ESTADOS, type ContactoEstado } from '@/types/business'
import type { ClientProspectRow } from '@/types/client-prospect'

function ProspectDetailInner() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const user = useSupabaseUser()
  const [row, setRow] = useState<ClientProspectRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ProspectThreadMessageRow[]>([])
  const [tasks, setTasks] = useState<ProspectTaskRow[]>([])
  const [msgBody, setMsgBody] = useState('')
  const [taskTitle, setTaskTitle] = useState('')

  const loggedIn = Boolean(user && isSupabaseConfigured())

  const load = useCallback(async () => {
    if (!id || !user || !isSupabaseConfigured()) {
      setRow(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const sb = createBrowserSupabaseClient()
    const { data, error: e1 } = await fetchClientProspectById(sb, id)
    if (e1 || !data) {
      setError(e1?.message ?? 'No encontrado.')
      setRow(null)
      setLoading(false)
      return
    }
    setRow(data)
    setError(null)
    const [m, t] = await Promise.all([listThreadMessages(sb, id), listProspectTasks(sb, id)])
    if (!m.error) setMessages(m.data ?? [])
    if (!t.error) setTasks(t.data ?? [])
    setLoading(false)
  }, [id, user])

  useEffect(() => {
    void load()
  }, [load])

  const neg = row ? clientProspectRowToNegocioFila(row) : null

  const handleEstado = async (estado: ContactoEstado) => {
    if (!row || !user || !isSupabaseConfigured()) return
    const prev = row.estado as ContactoEstado
    const sb = createBrowserSupabaseClient()
    const { error: uErr } = await updateClientProspectEstado(sb, row.id, estado)
    if (uErr) {
      setError(formatClientProspectError(uErr.message))
      return
    }
    setRow({ ...row, estado })
    const f = stableBusinessFingerprint({
      nombre: row.nombre,
      telefono: row.telefono,
      correo: row.correo,
      direccion: row.direccion,
    })
    if (estado === 'No interesado' && prev !== 'No interesado') {
      await upsertProspectBlacklist(sb, user.id, f, row.nombre, row.id)
    } else if (prev === 'No interesado' && estado !== 'No interesado') {
      await removeProspectBlacklistByFingerprint(sb, user.id, f)
    }
  }

  const sendMsg = async () => {
    if (!user || !row || !msgBody.trim() || !isSupabaseConfigured()) return
    const sb = createBrowserSupabaseClient()
    const { error: e } = await insertThreadMessage(sb, row.id, user.id, msgBody)
    if (e) setError(e.message)
    else {
      setMsgBody('')
      const m = await listThreadMessages(sb, row.id)
      if (!m.error) setMessages(m.data ?? [])
    }
  }

  const addTask = async () => {
    if (!user || !row || !taskTitle.trim() || !isSupabaseConfigured()) return
    const sb = createBrowserSupabaseClient()
    const { error: e } = await insertProspectTask(sb, row.id, user.id, taskTitle)
    if (e) setError(e.message)
    else {
      setTaskTitle('')
      const t = await listProspectTasks(sb, row.id)
      if (!t.error) setTasks(t.data ?? [])
    }
  }

  const toggleTask = async (taskId: string, done: boolean) => {
    const sb = createBrowserSupabaseClient()
    const { error: e } = await updateProspectTaskDone(sb, taskId, done)
    if (e) setError(e.message)
    else setTasks(prev => prev.map(x => (x.id === taskId ? { ...x, done } : x)))
  }

  if (!id) return null

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-8">
        <main className="flex-1 min-w-0 flex flex-col gap-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <Link href="/clientes-prospectos" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
              ← Clientes prospectos
            </Link>
          </div>
          {!loggedIn && (
            <p className="text-sm text-amber-800 border border-amber-200 rounded-xl px-4 py-3">
              <Link href="/login" className="underline font-semibold">
                Inicia sesión
              </Link>{' '}
              para ver el detalle.
            </p>
          )}
          {loading && <p className="text-sm text-neutral-500">Cargando…</p>}
          {!loading && !row && <p className="text-sm text-red-600">No se encontró el prospecto o no tienes acceso.</p>}
          {row && neg && (
            <>
              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-950/40">
                <div className="aspect-[21/9] max-h-[220px] bg-gradient-to-br from-indigo-100 to-neutral-100 dark:from-indigo-950 dark:to-neutral-900 flex items-end p-6">
                  <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">{neg.nombre}</h1>
                </div>
                <div className="p-6 grid sm:grid-cols-2 gap-4 text-sm">
                  {(
                    [
                      ['Dirección', neg.direccion],
                      ['Ciudad', neg.ciudad],
                      ['País', neg.pais],
                      ['Teléfono', neg.telefono],
                      ['Correo', neg.correo],
                      ['Sitio web', neg.sitioWeb],
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
                      {neg.problemasDetectados || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500">Oportunidades</p>
                    <p className="mt-1 text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap text-sm">
                      {neg.oportunidades || '—'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-neutral-500">Estado del proceso</label>
                    <select
                      value={row.estado}
                      onChange={e => void handleEstado(e.target.value as ContactoEstado)}
                      className="mt-2 max-w-xs block rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
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
        </main>

        {row && loggedIn && (
          <aside className="lg:w-[380px] shrink-0 flex flex-col gap-4 lg:sticky lg:top-20 self-start max-h-[calc(100vh-6rem)]">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-3 bg-neutral-50/50 dark:bg-neutral-950/40 overflow-hidden">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Actividad del equipo</h2>
              <div className="flex-1 overflow-y-auto max-h-[200px] flex flex-col gap-2 text-xs">
                {messages.length === 0 && <p className="text-neutral-500">Aún no hay mensajes.</p>}
                {messages.map(m => (
                  <div
                    key={m.id}
                    className="rounded-lg bg-white dark:bg-neutral-900/80 border border-neutral-100 dark:border-neutral-800 p-2"
                  >
                    <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{m.body}</p>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      {new Date(m.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 min-w-0 rounded-lg border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-xs bg-white dark:bg-neutral-950"
                  placeholder="Mensaje…"
                  value={msgBody}
                  onChange={e => setMsgBody(e.target.value)}
                />
                <button
                  type="button"
                  className="shrink-0 px-2 py-1.5 rounded-lg bg-indigo-600 text-white text-xs"
                  onClick={() => void sendMsg()}
                >
                  Enviar
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-3 bg-neutral-50/50 dark:bg-neutral-950/40">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Tareas</h2>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 px-2 py-1.5 text-xs bg-white dark:bg-neutral-950"
                  placeholder="Nueva tarea…"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                />
                <button
                  type="button"
                  className="px-2 py-1.5 rounded-lg bg-indigo-600 text-white text-xs"
                  onClick={() => void addTask()}
                >
                  Añadir
                </button>
              </div>
              <ul className="flex flex-col gap-2 max-h-[220px] overflow-y-auto text-sm">
                {tasks.map(t => (
                  <li key={t.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={e => void toggleTask(t.id, e.target.checked)}
                      className="mt-1"
                    />
                    <span className={t.done ? 'line-through text-neutral-400' : ''}>{t.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>
      {error && <Toast message={error} onClose={() => setError(null)} />}
    </div>
  )
}

export default function ProspectoDetailPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">Cargando…</div>}
    >
      <ProspectDetailInner />
    </Suspense>
  )
}
