'use client'

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  fetchProspectListMembersForMentions,
  removeProspectListCollaborator,
  type ProspectListMemberRow,
} from '@/lib/supabase/collaboration'
import { cn } from '@/lib/utils'

const AVATAR_HUES = ['bg-violet-600', 'bg-sky-600', 'bg-amber-600', 'bg-rose-600'] as const

function displayName(m: ProspectListMemberRow) {
  const a = (m.first_name ?? '').trim()
  const b = (m.last_name ?? '').trim()
  if (a || b) return [a, b].filter(Boolean).join(' ')
  return m.email
}

function avatarHueClass(userId: string) {
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h + userId.charCodeAt(i)) % AVATAR_HUES.length
  return AVATAR_HUES[h]
}

function MemberAvatar({ member }: { member: ProspectListMemberRow }) {
  const photo = member.avatar_url?.trim() || null
  const initials = displayName(member)
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <div
      className={cn(
        'shrink-0 w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold text-white',
        !photo && avatarHueClass(member.user_id),
      )}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        initials || '?'
      )}
    </div>
  )
}

export function SharedListMembersDialog({
  open,
  onClose,
  listId,
  listName,
  ownerId,
}: {
  open: boolean
  onClose: () => void
  listId: string
  listName: string
  ownerId: string
}) {
  const [members, setMembers] = useState<ProspectListMemberRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const collaborators = members.filter(m => m.user_id !== ownerId)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const sb = createBrowserSupabaseClient()
    const { data, error: err } = await fetchProspectListMembersForMentions(sb, listId)
    if (err) setError(err.message)
    else setMembers(data)
    setLoading(false)
  }, [listId])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  const handleRemove = async (userId: string, email: string) => {
    if (
      !window.confirm(
        `¿Dejar de compartir la lista «${listName}» con ${email}? Perderá el acceso a los prospectos de esta lista.`,
      )
    ) {
      return
    }
    setBusyUserId(userId)
    setError(null)
    const sb = createBrowserSupabaseClient()
    const { error: remErr } = await removeProspectListCollaborator(sb, listId, userId)
    setBusyUserId(null)
    if (remErr) {
      setError(remErr.message)
      return
    }
    await load()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-label="Cerrar" onClick={onClose} />
      <ListMembersDialogPanel listName={listName} onClose={onClose}>
        {loading && <p className="text-sm text-neutral-500 dark:text-neutral-400">Cargando miembros…</p>}
        {error && (
          <p className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {!loading && collaborators.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Nadie más tiene acceso a esta lista todavía. Usa «Compartir esta lista» para invitar colaboradores.
          </p>
        )}
        {!loading && collaborators.length > 0 && (
          <ul className="flex flex-col gap-2">
            {collaborators.map(m => (
              <li
                key={m.user_id}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-2.5 bg-neutral-50/80 dark:bg-neutral-900/60"
              >
                <MemberAvatar member={m} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{displayName(m)}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{m.email}</p>
                </div>
                <button
                  type="button"
                  disabled={busyUserId === m.user_id}
                  onClick={() => void handleRemove(m.user_id, m.email)}
                  className="shrink-0 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                >
                  {busyUserId === m.user_id ? '…' : 'Quitar acceso'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </ListMembersDialogPanel>
    </div>
  )
}

function ListMembersDialogPanel({
  listName,
  onClose,
  children,
}: {
  listName: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl p-6 flex flex-col gap-4 max-h-[min(90vh,520px)]">
      <div className="flex items-start justify-between gap-3 shrink-0">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 leading-snug pr-2">
          Compartido con — {listName}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0 flex flex-col gap-3">{children}</div>
    </div>
  )
}
