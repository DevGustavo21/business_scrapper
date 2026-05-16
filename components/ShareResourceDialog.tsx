'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (open) setRole(resourceType === 'prospect_list' ? 'editor' : 'viewer')
  }, [open, resourceType])

  if (!open) return null

  const sendInvite = async () => {
    setMsg(null)
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setMsg('Escribe un correo válido para enviar la invitación.')
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
          Introduce el correo y el permiso, luego pulsa <strong>Enviar invitación</strong>. Si prefieres no invitar ahora,
          pulsa <strong>Cancelar</strong>.
        </p>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Correo del invitado
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
            {resourceType === 'prospect_list' && (
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Con <strong>Solo lectura</strong> no pueden guardar prospectos en la lista; elige <strong>Puede editar</strong> si quieres
                que añadan negocios visibles para todo el equipo.
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
              {busy ? 'Enviando…' : 'Enviar invitación'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial sm:min-w-[7.5rem] py-2.5 rounded-xl text-sm font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
