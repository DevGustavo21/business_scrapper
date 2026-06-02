'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { createProspectList, listProspectListsForUser } from '@/lib/supabase/collaboration'
import type { ProspectListRow } from '@/types/collaboration'
import type { NegocioFila } from '@/types/business'

export type MarkProspectDest =
  | { kind: 'personal' }
  | { kind: 'shared_existing'; listId: string }
  | { kind: 'shared_new'; listId: string; name: string }

export function MarkProspectDialog({
  open,
  onClose,
  row,
  userId,
  lists,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  row: NegocioFila | null
  userId: string
  lists: ProspectListRow[]
  onConfirm: (dest: MarkProspectDest) => Promise<void>
}) {
  const t = useTranslations('markProspect')
  const [mode, setMode] = useState<'personal' | 'existing' | 'new'>('personal')
  const [existingListId, setExistingListId] = useState<string>('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!open || !row) return null

  const handleSubmit = async () => {
    setErr(null)
    setBusy(true)
    try {
      if (mode === 'personal') {
        await onConfirm({ kind: 'personal' })
        onClose()
        setMode('personal')
        setNewName('')
        setExistingListId('')
        return
      }
      if (mode === 'existing') {
        if (!existingListId) {
          setErr(t('chooseListError'))
          return
        }
        await onConfirm({ kind: 'shared_existing', listId: existingListId })
        onClose()
        return
      }
      const name = newName.trim()
      if (!name) {
        setErr(t('nameRequired'))
        return
      }
      const sb = createBrowserSupabaseClient()
      const { list, error } = await createProspectList(sb, userId, name)
      if (error || !list) {
        setErr(error?.message ?? t('createError'))
        return
      }
      await onConfirm({ kind: 'shared_new', listId: list.id, name: list.name })
      onClose()
      setNewName('')
      setMode('personal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label={t('close')} onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t('title')}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">{row.nombre}</p>

        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="dest" checked={mode === 'personal'} onChange={() => setMode('personal')} />
            {t('personal')}
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="dest" checked={mode === 'existing'} onChange={() => setMode('existing')} />
            {t('existing')}
          </label>
          {mode === 'existing' && (
            <select
              className="mt-1 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
              value={existingListId}
              onChange={e => setExistingListId(e.target.value)}
            >
              <option value="">{t('choose')}</option>
              {lists.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.owner_id !== userId ? t('sharedSuffix') : ''}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="dest" checked={mode === 'new'} onChange={() => setMode('new')} />
            {t('new')}
          </label>
          {mode === 'new' && (
            <input
              className="mt-1 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
              placeholder={t('newPlaceholder')}
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          )}
        </div>

        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" className="px-3 py-2 text-sm rounded-lg border" onClick={onClose} disabled={busy}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => void handleSubmit()}
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export async function loadProspectListsForMark(
  supabase: ReturnType<typeof createBrowserSupabaseClient>,
  userId: string,
): Promise<ProspectListRow[]> {
  const { data } = await listProspectListsForUser(supabase, userId)
  return data ?? []
}
