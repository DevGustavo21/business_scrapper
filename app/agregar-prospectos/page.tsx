'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { ResultsTable } from '@/components/ResultsTable'
import { Toast } from '@/components/Toast'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import {
  listManualClientProspects,
  insertManualClientProspect,
  updateManualClientProspect,
  deleteClientProspectById,
  clientProspectRowToNegocioFila,
  formatClientProspectError,
} from '@/lib/supabase/clientProspects'
import { CONTACTO_ESTADOS, type ContactoEstado, type NegocioFila } from '@/types/business'
import type { ClientProspectRow } from '@/types/client-prospect'

const emptyForm = {
  nombre: '',
  direccion: '',
  ciudad: '',
  pais: '',
  telefono: '',
  correo: '',
  sitioWeb: '',
  problemasDetectados: '',
  oportunidades: '',
  estado: 'Sin contactar' as ContactoEstado,
}

export default function AgregarProspectosPage() {
  const user = useSupabaseUser()
  const [rows, setRows] = useState<ClientProspectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  const loggedIn = Boolean(user && isSupabaseConfigured())

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const sb = createBrowserSupabaseClient()
    const { data, error: err } = await listManualClientProspects(sb)
    if (err) setError(formatClientProspectError(err.message))
    else setError(null)
    setRows(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const startEdit = (r: ClientProspectRow) => {
    setEditingId(r.id)
    setForm({
      nombre: r.nombre,
      direccion: r.direccion,
      ciudad: r.ciudad,
      pais: r.pais,
      telefono: r.telefono,
      correo: r.correo,
      sitioWeb: r.sitio_web,
      problemasDetectados: r.problemas_detectados,
      oportunidades: r.oportunidades,
      estado: r.estado,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !isSupabaseConfigured()) return
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    setError(null)
    const sb = createBrowserSupabaseClient()
    if (editingId) {
      const { error: uErr } = await updateManualClientProspect(sb, editingId, form)
      if (uErr) setError(formatClientProspectError(uErr.message))
      else resetForm()
    } else {
      const { error: iErr } = await insertManualClientProspect(sb, user.id, form)
      if (iErr) setError(formatClientProspectError(iErr.message))
      else resetForm()
    }
    setSaving(false)
    await load()
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este prospecto manual?')) return
    if (!user || !isSupabaseConfigured()) return
    const sb = createBrowserSupabaseClient()
    const { error: dErr } = await deleteClientProspectById(sb, id)
    if (dErr) setError(formatClientProspectError(dErr.message))
    else {
      if (editingId === id) resetForm()
      await load()
    }
  }

  const negocios: NegocioFila[] = rows.map(r => ({
    ...clientProspectRowToNegocioFila(r),
    prospectSource: 'manual' as const,
  }))

  const handleEstadoChange = async (id: string, estado: ContactoEstado) => {
    if (!user || !isSupabaseConfigured()) return
    const row = rows.find(r => r.id === id)
    if (!row) return
    const sb = createBrowserSupabaseClient()
    const { error: uErr } = await updateManualClientProspect(sb, id, {
      nombre: row.nombre,
      direccion: row.direccion,
      ciudad: row.ciudad,
      pais: row.pais,
      telefono: row.telefono,
      correo: row.correo,
      sitioWeb: row.sitio_web,
      problemasDetectados: row.problemas_detectados,
      oportunidades: row.oportunidades,
      estado,
    })
    if (uErr) setError(formatClientProspectError(uErr.message))
    else await load()
  }

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100'

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">Agregar prospectos</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Alta manual de clientes potenciales. Los registros aparecen también en{' '}
            <Link href="/clientes-prospectos" className="text-indigo-600 dark:text-indigo-400 font-medium">
              Clientes prospectos
            </Link>
            .
          </p>
        </div>

        {!loggedIn && (
          <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            <Link href="/login" className="font-semibold underline">
              Inicia sesión
            </Link>{' '}
            para guardar prospectos en la nube.
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 space-y-4 bg-neutral-50/50 dark:bg-neutral-950/30"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {editingId ? 'Editar prospecto' : 'Nuevo prospecto'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                Cancelar edición
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="sm:col-span-2 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Nombre *
              <input
                className={inputClass + ' mt-1'}
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                disabled={!loggedIn || saving}
                required
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Dirección
              <input
                className={inputClass + ' mt-1'}
                value={form.direccion}
                onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Ciudad
              <input
                className={inputClass + ' mt-1'}
                value={form.ciudad}
                onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              País
              <input
                className={inputClass + ' mt-1'}
                value={form.pais}
                onChange={e => setForm(f => ({ ...f, pais: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Teléfono
              <input
                className={inputClass + ' mt-1'}
                value={form.telefono}
                onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Correo
              <input
                className={inputClass + ' mt-1'}
                type="email"
                value={form.correo}
                onChange={e => setForm(f => ({ ...f, correo: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="sm:col-span-2 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Sitio web
              <input
                className={inputClass + ' mt-1'}
                value={form.sitioWeb}
                onChange={e => setForm(f => ({ ...f, sitioWeb: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="sm:col-span-2 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Problemas detectados
              <textarea
                className={inputClass + ' mt-1 min-h-[72px]'}
                value={form.problemasDetectados}
                onChange={e => setForm(f => ({ ...f, problemasDetectados: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="sm:col-span-2 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Oportunidades
              <textarea
                className={inputClass + ' mt-1 min-h-[72px]'}
                value={form.oportunidades}
                onChange={e => setForm(f => ({ ...f, oportunidades: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Estado
              <select
                className={inputClass + ' mt-1 cursor-pointer'}
                value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value as ContactoEstado }))}
                disabled={!loggedIn || saving}
              >
                {CONTACTO_ESTADOS.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!loggedIn || saving}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              {saving ? 'Guardando…' : editingId ? 'Actualizar' : 'Crear prospecto'}
            </button>
          </div>
        </form>

        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Prospectos manuales</h2>
          <p className="text-xs text-neutral-500 mb-3">
            Pulsa el corazón para eliminar de tu lista de prospectos (y de esta tabla).
          </p>
          <ResultsTable
            negocios={negocios}
            loading={loading}
            onEstadoChange={handleEstadoChange}
            summaryMode="list"
            prospectHeart={
              loggedIn
                ? {
                    enabled: true,
                    disabled: loading,
                    removeOnly: true,
                    onToggle: row => void handleDelete(row.id),
                  }
                : undefined
            }
          />
          {!loading && loggedIn && rows.length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Aún no hay prospectos manuales.</p>
          )}
        </div>

        {!loading && rows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {rows.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => startEdit(r)}
                className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Editar: {r.nombre.slice(0, 28)}
                {r.nombre.length > 28 ? '…' : ''}
              </button>
            ))}
          </div>
        )}
      </main>

      {error && <Toast message={error} onClose={() => setError(null)} />}
    </div>
  )
}
