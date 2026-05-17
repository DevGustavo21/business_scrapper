'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import {
  acceptCollaborationInviteRpc,
  declineCollaborationInviteRpc,
} from '@/lib/supabase/collaboration'
import {
  countUnreadNotifications,
  deleteMyNotification,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/supabase/notifications'
import type { NotificationRow } from '@/types/collaboration'
import { cn } from '@/lib/utils'

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ''
  }
}

function notificationLink(n: NotificationRow): { href: string; label: string } | null {
  const d = n.data as Record<string, unknown>
  if (n.type === 'folder_search_added' && typeof d.folder_id === 'string') {
    return { href: `/carpetas?folder=${encodeURIComponent(d.folder_id)}`, label: 'Ver carpeta' }
  }
  if (n.type === 'list_prospect_added' && typeof d.prospect_list_id === 'string') {
    return {
      href: `/lista/${encodeURIComponent(d.prospect_list_id)}`,
      label: 'Ver lista',
    }
  }
  if (n.type === 'thread_mention') {
    if (typeof d.client_prospect_id === 'string') {
      return {
        href: `/prospecto/${encodeURIComponent(d.client_prospect_id)}`,
        label: 'Ver conversación',
      }
    }
    if (typeof d.prospect_search_id === 'string' && typeof d.negocio_row_id === 'string') {
      return {
        href: `/busqueda/${encodeURIComponent(d.prospect_search_id)}/negocio/${encodeURIComponent(d.negocio_row_id)}`,
        label: 'Ver conversación',
      }
    }
  }
  return null
}

type PanelLayout = {
  top: number
  left: number
  width: number
  maxHeight: number
}

function computePanelLayout(anchor: DOMRect): PanelLayout {
  const margin = 8
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(380, vw - margin * 2)
  const left = Math.max(margin, Math.min(anchor.right - width, vw - width - margin))
  const top = anchor.bottom + margin
  const maxHeight = Math.max(160, Math.min(420, vh - top - margin))
  return { top, left, width, maxHeight }
}

export function NotificationsPopover() {
  const user = useSupabaseUser()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [unread, setUnread] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [panelLayout, setPanelLayout] = useState<PanelLayout | null>(null)
  const [mounted, setMounted] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const loggedIn = Boolean(user && isSupabaseConfigured())

  const refresh = useCallback(async () => {
    if (!loggedIn) return
    const sb = createBrowserSupabaseClient()
    const [{ data, error }, uc] = await Promise.all([listMyNotifications(sb, 50), countUnreadNotifications(sb)])
    if (!error && data) setItems(data)
    if (!uc.error) setUnread(uc.count)
  }, [loggedIn])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!loggedIn) return
    void refresh()
    const t = window.setInterval(() => void refresh(), 45_000)
    return () => window.clearInterval(t)
  }, [loggedIn, refresh])

  useEffect(() => {
    if (!open) return
    void refresh()
  }, [open, refresh])

  const updatePanelLayout = useCallback(() => {
    if (!btnRef.current) return
    setPanelLayout(computePanelLayout(btnRef.current.getBoundingClientRect()))
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPanelLayout(null)
      return
    }
    updatePanelLayout()
    window.addEventListener('resize', updatePanelLayout)
    window.addEventListener('scroll', updatePanelLayout, true)
    return () => {
      window.removeEventListener('resize', updatePanelLayout)
      window.removeEventListener('scroll', updatePanelLayout, true)
    }
  }, [open, updatePanelLayout])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (wrapRef.current?.contains(target)) return
      if (document.getElementById('notifications-popover-panel')?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (!loggedIn) return null

  const dismissInviteNotification = async (notificationId: string) => {
    setItems(prev => prev.filter(x => x.id !== notificationId))
    const sb = createBrowserSupabaseClient()
    const { error: delErr } = await deleteMyNotification(sb, notificationId)
    if (delErr) {
      await markNotificationRead(sb, notificationId)
    }
    await refresh()
  }

  const handleAcceptInvite = async (inviteId: string, notificationId: string) => {
    setBusyId(inviteId)
    const sb = createBrowserSupabaseClient()
    const { ok, error } = await acceptCollaborationInviteRpc(sb, inviteId)
    setBusyId(null)
    if (ok && !error) {
      await dismissInviteNotification(notificationId)
      return
    }
    const msg = error?.message ?? ''
    if (/not_pending|not_found|wrong_user|email_mismatch/i.test(msg)) {
      await dismissInviteNotification(notificationId)
      return
    }
    window.alert(msg || 'No se pudo aceptar.')
  }

  const handleDeclineInvite = async (inviteId: string, notificationId: string) => {
    setBusyId(inviteId)
    const sb = createBrowserSupabaseClient()
    const { ok, error } = await declineCollaborationInviteRpc(sb, inviteId)
    setBusyId(null)
    if (ok && !error) {
      await dismissInviteNotification(notificationId)
      return
    }
    const msg = error?.message ?? ''
    if (/not_pending|not_found|wrong_user|email_mismatch/i.test(msg)) {
      await dismissInviteNotification(notificationId)
      return
    }
    window.alert(msg || 'No se pudo rechazar.')
  }

  const handleMarkRead = async (id: string) => {
    const sb = createBrowserSupabaseClient()
    await markNotificationRead(sb, id)
    await refresh()
  }

  const handleMarkAll = async () => {
    const sb = createBrowserSupabaseClient()
    await markAllNotificationsRead(sb)
    await refresh()
  }

  const inviteIdFromData = (n: NotificationRow): string | null => {
    const d = n.data as Record<string, unknown>
    return typeof d.invite_id === 'string' ? d.invite_id : null
  }

  const panel =
    open && panelLayout && mounted ? (
      <>
        <button
          type="button"
          className="fixed inset-0 z-[90] bg-black/20 sm:bg-transparent sm:pointer-events-none"
          aria-label="Cerrar notificaciones"
          onClick={() => setOpen(false)}
        />
        <NotificationsPanel
          panelLayout={panelLayout}
          items={items}
          unread={unread}
          busyId={busyId}
          onClose={() => setOpen(false)}
          onMarkAll={() => void handleMarkAll()}
          inviteIdFromData={inviteIdFromData}
          notificationLink={notificationLink}
          formatWhen={formatWhen}
          onAcceptInvite={handleAcceptInvite}
          onDeclineInvite={handleDeclineInvite}
          onMarkRead={handleMarkRead}
        />
      </>
    ) : null

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        aria-label="Notificaciones"
        aria-expanded={open}
        className={cn(
          'relative p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors',
          open && 'ring-2 ring-indigo-500/40',
        )}
        onClick={() => setOpen(v => !v)}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {mounted && panel && createPortal(panel, document.body)}
    </div>
  )
}

function NotificationsPanel({
  panelLayout,
  items,
  unread,
  busyId,
  onClose,
  onMarkAll,
  inviteIdFromData,
  notificationLink,
  formatWhen,
  onAcceptInvite,
  onDeclineInvite,
  onMarkRead,
}: {
  panelLayout: PanelLayout
  items: NotificationRow[]
  unread: number
  busyId: string | null
  onClose: () => void
  onMarkAll: () => void
  inviteIdFromData: (n: NotificationRow) => string | null
  notificationLink: (n: NotificationRow) => { href: string; label: string } | null
  formatWhen: (iso: string) => string
  onAcceptInvite: (inviteId: string, notificationId: string) => void
  onDeclineInvite: (inviteId: string, notificationId: string) => void
  onMarkRead: (id: string) => void
}) {
  return (
    <div
      id="notifications-popover-panel"
      style={{
        position: 'fixed',
        top: panelLayout.top,
        left: panelLayout.left,
        width: panelLayout.width,
        maxHeight: panelLayout.maxHeight,
        zIndex: 100,
      }}
      className={cn(
        'overflow-hidden rounded-xl flex flex-col',
        'border border-neutral-200 dark:border-zinc-600',
        'bg-[#ffffff] dark:bg-[#18181b]',
        'ring-1 ring-black/[0.06] dark:ring-white/[0.08]',
        'shadow-2xl shadow-black/20 dark:shadow-black/50',
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5 border-b border-neutral-200 dark:border-zinc-700 bg-[#f5f5f5] dark:bg-[#27272a]">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-800 dark:text-zinc-100">
          Notificaciones
          {unread > 0 ? ` (${unread})` : ''}
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href="/compartido"
            className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            onClick={onClose}
          >
            Invitaciones
          </Link>
          <button
            type="button"
            className="text-[11px] font-medium text-neutral-600 dark:text-zinc-300 hover:text-neutral-900 dark:hover:text-white"
            onClick={onMarkAll}
          >
            Marcar leídas
          </button>
        </div>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0 p-2.5 flex flex-col gap-2 bg-[#fafafa] dark:bg-[#18181b] overscroll-contain">
        {items.length === 0 && (
          <p className="text-xs text-neutral-700 dark:text-zinc-300 px-2 py-8 text-center">No hay notificaciones recientes.</p>
        )}
        {items.map(n => {
          const link = notificationLink(n)
          const inviteId = n.type === 'collab_invite' ? inviteIdFromData(n) : null
          const unreadDot = !n.read_at
          return (
            <div
              key={n.id}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-xs flex flex-col gap-1.5 shadow-sm',
                unreadDot
                  ? 'border-indigo-300 dark:border-indigo-600 bg-[#eef2ff] dark:bg-[#1e1b4b] dark:ring-1 dark:ring-indigo-900/80'
                  : 'border-neutral-200 dark:border-zinc-600 bg-[#ffffff] dark:bg-[#27272a]',
              )}
            >
              <NotificationItemHeader title={n.title} createdAt={n.created_at} formatWhen={formatWhen} />
              {n.body && (
                <p className="text-neutral-800 dark:text-zinc-200 leading-relaxed text-[11px] break-words">{n.body}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-0.5">
                {inviteId && (
                  <>
                    <button
                      type="button"
                      disabled={busyId === inviteId}
                      className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 disabled:opacity-50"
                      onClick={() => void onAcceptInvite(inviteId, n.id)}
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === inviteId}
                      className="px-2.5 py-1 rounded-md border border-neutral-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-neutral-800 dark:text-zinc-200 text-[11px] font-medium hover:bg-neutral-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                      onClick={() => void onDeclineInvite(inviteId, n.id)}
                    >
                      Rechazar
                    </button>
                  </>
                )}
                {link && (
                  <Link
                    href={link.href}
                    className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    onClick={onClose}
                  >
                    {link.label}
                  </Link>
                )}
                {!n.read_at && n.type !== 'collab_invite' && (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-neutral-600 dark:text-zinc-400 hover:underline ml-auto"
                    onClick={() => void onMarkRead(n.id)}
                  >
                    Marcar leída
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NotificationItemHeader({
  title,
  createdAt,
  formatWhen,
}: {
  title: string
  createdAt: string
  formatWhen: (iso: string) => string
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="font-semibold text-neutral-900 dark:text-zinc-50 leading-snug break-words min-w-0">{title}</span>
      <span className="shrink-0 text-[10px] text-neutral-600 dark:text-zinc-400 tabular-nums">{formatWhen(createdAt)}</span>
    </div>
  )
}
