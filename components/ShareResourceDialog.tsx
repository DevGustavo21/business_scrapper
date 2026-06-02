'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { CollaborationResourceType, CollaborationRole } from '@/types/collaboration'
import { insertCollaborationInvite, normalizeShareEmail } from '@/lib/supabase/collaboration'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ShareResourceDialog({
  open,
  onClose,
  title,
  resourceType,
  resourceId,
  inviterUserId,
  inviterEmail,
}: {
  open: boolean
  onClose: () => void
  title: string
  resourceType: CollaborationResourceType
  resourceId: string
  inviterUserId: string
  inviterEmail: string | undefined
}) {
  const t = useTranslations('shareDialog')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<CollaborationRole>('viewer')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (open) setRole(resourceType === 'prospect_list' ? 'editor' : 'viewer')
  }, [open, resourceType])

  if (!open) return null

  const sendInvite = async () => {
    setMsg(null)
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setMsg(t('invalidEmail'))
      return
    }
    const norm = normalizeShareEmail(trimmed)
    if (inviterEmail && normalizeShareEmail(inviterEmail) === norm) {
      setMsg(t('selfInvite'))
      return
    }
    setBusy(true)
    const sb = createBrowserSupabaseClient()
    const { inviteeUserId, error } = await insertCollaborationInvite(sb, {
      resourceType,
      resourceId,
      inviteeEmail: trimmed,
      role,
      invitedBy: inviterUserId,
    })
    setBusy(false)
    if (error) {
      if (/duplicate|unique|pending_unique/i.test(error.message)) {
        setMsg(t('duplicate'))
      } else {
        setMsg(error.message)
      }
      return
    }
    if (inviteeUserId) {
      setMsg(
        t('sentExisting'),
      )
    } else {
      setMsg(
        t('sentNew'),
      )
    }
    setEmail('')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-label={t('close')} onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t('title', { title })}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
          {t('description')}
        </p>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
            {t('email')}
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nombre@empresa.com"
              className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
              disabled={busy}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
            {t('permission')}
            <select
              value={role}
              onChange={e => setRole(e.target.value as CollaborationRole)}
              className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
              disabled={busy}
            >
              <option value="viewer">{t('viewer')}</option>
              <option value="editor">{t('editor')}</option>
            </select>
            {resourceType === 'prospect_list' && (
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {t('listHint')}
              </p>
            )}
          </label>
          {msg && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-neutral-50 dark:bg-neutral-800/60">
              {msg}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={() => void sendInvite()}
              disabled={busy || !email.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? t('sending') : t('send')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial sm:min-w-[7.5rem] py-2.5 rounded-xl text-sm font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
