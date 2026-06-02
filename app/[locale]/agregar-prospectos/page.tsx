'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { ResultsTable } from '@/components/ResultsTable'
import { SimpleInfoModal } from '@/components/SimpleInfoModal'
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
  updateClientProspectListId,
} from '@/lib/supabase/clientProspects'
import { listProspectListsForUser } from '@/lib/supabase/collaboration'
import type { ProspectListRow } from '@/types/collaboration'
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
  const t = useTranslations('addProspects')
  const tResults = useTranslations('resultsTable')
  const user = useSupabaseUser()
  const [rows, setRows] = useState<ClientProspectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [successModal, setSuccessModal] = useState<{ kind: 'created' | 'updated'; nombre: string } | null>(null)
  const [prospectLists, setProspectLists] = useState<ProspectListRow[]>([])
  const [selectedListId, setSelectedListId] = useState<string | null>(null)

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

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) {
      setProspectLists([])
      return
    }
    const sb = createBrowserSupabaseClient()
    void listProspectListsForUser(sb, user.id).then(({ data }) => setProspectLists(data))
  }, [user])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setSelectedListId(null)
  }

  const startEdit = (r: ClientProspectRow) => {
    setEditingId(r.id)
    setSelectedListId(r.prospect_list_id ?? null)
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
      setError(t('nameRequired'))
      return
    }
    setSaving(true)
    setError(null)
    const nombreHecho = form.nombre.trim()
    const sb = createBrowserSupabaseClient()
    if (editingId) {
      const { error: uErr } = await updateManualClientProspect(sb, editingId, form)
      if (uErr) setError(formatClientProspectError(uErr.message))
      else {
        const { error: lErr } = await updateClientProspectListId(sb, editingId, selectedListId)
        if (lErr) setError(formatClientProspectError(lErr.message))
        else {
          resetForm()
          setSuccessModal({ kind: 'updated', nombre: nombreHecho })
        }
      }
    } else {
      const { error: iErr } = await insertManualClientProspect(sb, user.id, form, selectedListId)
      if (iErr) setError(formatClientProspectError(iErr.message))
      else {
        resetForm()
        setSuccessModal({ kind: 'created', nombre: nombreHecho })
      }
    }
    setSaving(false)
    await load()
  }

  const handleDelete = async (id: string) => {
    if (!user || !isSupabaseConfigured()) return
    const sb = createBrowserSupabaseClient()
    const { error: dErr } = await deleteClientProspectById(sb, id)
    if (dErr) setError(formatClientProspectError(dErr.message))
    else {
      if (editingId === id) resetForm()
      await load()
    }
  }

  const requestDeleteRow = (row: NegocioFila) => {
    if (!window.confirm(t('deleteConfirm', { name: row.nombre }))) return
    void handleDelete(row.id)
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
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">{t('title')}</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {t('subtitleStart')}{' '}
            <Link href="/clientes-prospectos" className="text-indigo-600 dark:text-indigo-400 font-medium">
              {t('clientProspectsLink')}
            </Link>
            .
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

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 space-y-4 bg-neutral-50/50 dark:bg-neutral-950/30"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {editingId ? t('editProspect') : t('newProspect')}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                {t('cancelEdit')}
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="sm:col-span-2 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('destinationList')}
              <select
                className={inputClass + ' mt-1'}
                value={selectedListId ?? ''}
                onChange={e => setSelectedListId(e.target.value || null)}
                disabled={!loggedIn || saving}
              >
                <option value="">{t('personalNoList')}</option>
                {prospectLists.map(pl => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-neutral-500 font-normal">
                {t('listHelpStart')}{' '}
                <Link href="/clientes-prospectos" className="text-indigo-600 dark:text-indigo-400 font-medium">
                  {t('prospectListsLink')}
                </Link>
                .
              </span>
            </label>
            <label className="sm:col-span-2 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('name')}
              <input
                className={inputClass + ' mt-1'}
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                disabled={!loggedIn || saving}
                required
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('address')}
              <input
                className={inputClass + ' mt-1'}
                value={form.direccion}
                onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('city')}
              <input
                className={inputClass + ' mt-1'}
                value={form.ciudad}
                onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('country')}
              <input
                className={inputClass + ' mt-1'}
                value={form.pais}
                onChange={e => setForm(f => ({ ...f, pais: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('phone')}
              <input
                className={inputClass + ' mt-1'}
                value={form.telefono}
                onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('email')}
              <input
                className={inputClass + ' mt-1'}
                type="email"
                value={form.correo}
                onChange={e => setForm(f => ({ ...f, correo: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="sm:col-span-2 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('website')}
              <input
                className={inputClass + ' mt-1'}
                value={form.sitioWeb}
                onChange={e => setForm(f => ({ ...f, sitioWeb: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="sm:col-span-2 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('detectedProblems')}
              <textarea
                className={inputClass + ' mt-1 min-h-[72px]'}
                value={form.problemasDetectados}
                onChange={e => setForm(f => ({ ...f, problemasDetectados: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="sm:col-span-2 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('opportunities')}
              <textarea
                className={inputClass + ' mt-1 min-h-[72px]'}
                value={form.oportunidades}
                onChange={e => setForm(f => ({ ...f, oportunidades: e.target.value }))}
                disabled={!loggedIn || saving}
              />
            </label>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {t('status')}
              <select
                className={inputClass + ' mt-1 cursor-pointer'}
                value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value as ContactoEstado }))}
                disabled={!loggedIn || saving}
              >
                {CONTACTO_ESTADOS.map(s => (
                  <option key={s} value={s}>
                    {tResults(`statuses.${s}`)}
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
              {saving ? t('saving') : editingId ? t('updateProspect') : t('createProspect')}
            </button>
          </div>
        </form>

        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">{t('manualProspects')}</h2>
          <p className="text-xs text-neutral-500 mb-3">
            {t('manualHelp')}
          </p>
          <ResultsTable
            negocios={negocios}
            loading={loading}
            onEstadoChange={handleEstadoChange}
            summaryMode="list"
            deleteRow={
              loggedIn
                ? {
                    enabled: true,
                    disabled: loading,
                    title: t('deleteTitle'),
                    onDelete: requestDeleteRow,
                  }
                : undefined
            }
          />
          {!loading && loggedIn && rows.length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('emptyManual')}</p>
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
                {t('editLabel', { name: r.nombre.slice(0, 28) })}
                {r.nombre.length > 28 ? '…' : ''}
              </button>
            ))}
          </div>
        )}
      </main>

      {error && <Toast message={error} onClose={() => setError(null)} />}
      <SimpleInfoModal
        open={successModal !== null}
        title={successModal?.kind === 'created' ? t('createdTitle') : t('updatedTitle')}
        message={
          successModal
            ? successModal.kind === 'created'
              ? t('createdMessage', { name: successModal.nombre })
              : t('updatedMessage', { name: successModal.nombre })
            : ''
        }
        onClose={() => setSuccessModal(null)}
      />
    </div>
  )
}
