'use client'

import { useState } from 'react'
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
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<CollaborationRole>('viewer')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setMsg('Escribe un correo válido.')
      return
    }
    const norm = normalizeShareEmail(trimmed)
    if (inviterEmail && normalizeShareEmail(inviterEmail) === norm) {
      setMsg('No puedes invitarte a ti mismo.')
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
        setMsg('Ya existe una invitación pendiente para ese correo en este recurso.')
      } else {
        setMsg(error.message)
      }
      return
    }
    if (inviteeUserId) {
      setMsg(
        'Invitación enviada. El usuario ya tiene cuenta y verá una notificación en la app. Cuando acepte, tendrá acceso compartido.',
      )
    } else {
      setMsg(
        'Invitación registrada. Esa persona aún no aparece en la plataforma: debe iniciar sesión con Google usando exactamente este correo. Al hacerlo, verá la invitación en el icono de campana o en «Compartido».',
      )
    }
    setEmail('')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-label="Cerrar" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Compartir: {title}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
          Introduce el correo del compañero. Si ya está registrado, recibirá una notificación. Si no, la invitación
          quedará pendiente hasta que entre con ese mismo correo (Google).
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Correo
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
            Permiso
            <select
              value={role}
              onChange={e => setRole(e.target.value as CollaborationRole)}
              className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
              disabled={busy}
            >
              <option value="viewer">Solo lectura</option>
              <option value="editor">Puede editar (añadir o quitar ítems)</option>
            </select>
          </label>
          {msg && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-neutral-50 dark:bg-neutral-800/60">
              {msg}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
            >
              {busy ? 'Enviando…' : 'Enviar invitación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
