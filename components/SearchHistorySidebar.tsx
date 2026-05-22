'use client'

import { Plus, MessageSquare, Trash2, Settings, ChevronRight, X } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ProspectSearchListItem } from '@/types/prospect-search'

const ACTIVE_KEY = 'bp_active_search_id'

export function readStoredActiveSearchId(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(ACTIVE_KEY)
}

export function writeStoredActiveSearchId(id: string | null) {
  if (typeof sessionStorage === 'undefined') return
  if (id) sessionStorage.setItem(ACTIVE_KEY, id)
  else sessionStorage.removeItem(ACTIVE_KEY)
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ''
  }
}

export function SearchHistoryConfigFooter() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="relative py-0.5" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="peer flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800/80"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <Settings size={16} className="shrink-0 text-neutral-500 dark:text-neutral-400" aria-hidden />
          Configuración
        </span>
        <ChevronRight
          size={16}
          className={`shrink-0 text-neutral-400 transition-transform rotate-[-90deg] ${open ? 'text-indigo-500' : ''}`}
        />
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 right-0 z-30 mb-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 py-1 shadow-lg"
          role="menu"
        >
          <Link
            href="/settings/perfil"
            className="block px-3 py-2.5 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Perfil
          </Link>
          <Link
            href="/settings/lista-negra"
            className="block px-3 py-2.5 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Lista negra
          </Link>
        </div>
      )}
    </div>
  )
}

export function SearchHistorySidebar({
  items,
  activeId,
  loading,
  disabled,
  onSelect,
  onNew,
  onDelete,
  onClose,
  loggedIn,
  className,
  sidebarFooter,
}: {
  items: ProspectSearchListItem[]
  activeId: string | null
  loading: boolean
  disabled?: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  /** Cierre desde dentro del panel (botón X). Si no se pasa, no se muestra. */
  onClose?: () => void
  loggedIn: boolean
  className?: string
  sidebarFooter?: ReactNode
}) {
  return (
    <aside
      className={cn(
        'flex flex-col min-h-0 border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 shadow-2xl',
        className,
      )}
    >
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Historial
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onNew}
            disabled={disabled || loading || !loggedIn}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            Nueva
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar historial"
              title="Cerrar"
              className="shrink-0 p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/80"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      <div className={`flex-1 overflow-y-auto p-2 ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
        {!loggedIn && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 px-2 py-3 leading-relaxed">
            Inicia sesión para guardar tus búsquedas aquí. Solo aparecen las que tú ejecutas; las compartidas por carpetas se
            abren desde <strong>Carpetas</strong>.
          </p>
        )}
        {loggedIn && items.length === 0 && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 px-2 py-3">
            Aún no hay búsquedas tuyas. Pulsa <strong>Nueva</strong> y lanza una búsqueda.
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {items.map(item => {
            const active = item.id === activeId
            const label = `${item.categoria} · ${item.ubicacion}`
            return (
              <li key={item.id}>
                <div
                  className={`flex items-stretch gap-0.5 rounded-xl border transition-colors ${
                    active
                      ? 'border-indigo-500/60 bg-indigo-50 dark:bg-indigo-950/40'
                      : 'border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800/80'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    disabled={loading}
                    className="min-w-0 flex-1 text-left rounded-l-xl px-3 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 disabled:opacity-50"
                  >
                    <span className="flex items-start gap-2">
                      <MessageSquare size={16} className="shrink-0 mt-0.5 text-indigo-500" />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 font-medium text-neutral-900 dark:text-neutral-100">{label}</span>
                        <span className="mt-0.5 block text-[11px] text-neutral-500 dark:text-neutral-500">
                          {formatWhen(item.updated_at)} · {item.result_count}/{item.cantidad_solicitada}
                          {item.status === 'running' ? ' · en curso' : ''}
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Eliminar del historial"
                    title="Eliminar"
                    disabled={loading || disabled}
                    onClick={e => {
                      e.stopPropagation()
                      onDelete(item.id)
                    }}
                    className="shrink-0 self-stretch flex items-center justify-center px-2 rounded-r-xl text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      {sidebarFooter ? (
        <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 p-2 bg-neutral-50/90 dark:bg-neutral-950/80">
          {sidebarFooter}
        </div>
      ) : null}
    </aside>
  )
}
