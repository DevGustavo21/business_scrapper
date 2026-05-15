'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { addSearchToFolder, createSearchFolder, listSearchFoldersForUser } from '@/lib/supabase/collaboration'
import type { SearchFolderRow } from '@/types/collaboration'

export function AddSearchToFolderDialog({
  open,
  onClose,
  userId,
  prospectSearchId,
  searchLabel,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  userId: string
  prospectSearchId: string
  searchLabel: string
  onAdded?: () => void
}) {
  const [folders, setFolders] = useState<SearchFolderRow[]>([])
  const [folderId, setFolderId] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const sb = createBrowserSupabaseClient()
    void listSearchFoldersForUser(sb, userId).then(({ data, error: err }) => {
      if (err) setError(err.message)
      else {
        setError(null)
        setFolders(data)
        if (data.length) setFolderId(prev => prev || data[0].id)
      }
    })
  }, [open, userId])

  if (!open) return null

  const handleCreateAndAdd = async () => {
    const name = newName.trim()
    if (!name) {
      setError('El nombre de la carpeta es obligatorio.')
      return
    }
    setBusy(true)
    setError(null)
    const sb = createBrowserSupabaseClient()
    const { folder, error: ce } = await createSearchFolder(sb, userId, name)
    if (ce || !folder) {
      setBusy(false)
      setError(ce?.message ?? 'No se pudo crear la carpeta.')
      return
    }
    const { error: ae } = await addSearchToFolder(sb, userId, folder.id, prospectSearchId)
    setBusy(false)
    if (ae) setError(ae.message)
    else {
      setNewName('')
      onAdded?.()
      onClose()
    }
  }

  const handleAddExisting = async () => {
    if (!folderId) {
      setError('Selecciona una carpeta.')
      return
    }
    setBusy(true)
    setError(null)
    const sb = createBrowserSupabaseClient()
    const { error: ae } = await addSearchToFolder(sb, userId, folderId, prospectSearchId)
    setBusy(false)
    if (ae) setError(ae.message)
    else {
      onAdded?.()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-label="Cerrar" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Añadir a carpeta</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Carpeta compartida de búsquedas — guarda esta lista junto con otras para trabajar en equipo.
        </p>
        <p className="text-xs text-neutral-500 line-clamp-2">{searchLabel}</p>

        {folders.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Carpeta existente</label>
            <select
              value={folderId}
              onChange={e => setFolderId(e.target.value)}
              className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
              disabled={busy}
            >
              {folders.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={handleAddExisting}
              className="py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Añadir a carpeta seleccionada
            </button>
          </div>
        )}

        <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 flex flex-col gap-2">
          <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Nueva carpeta</label>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nombre de la carpeta"
            className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy}
            onClick={handleCreateAndAdd}
            className="py-2.5 rounded-xl text-sm font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Crear carpeta y añadir esta búsqueda
          </button>
        </div>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="button"
          onClick={onClose}
          className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
