'use client'

import { Plus, MessageSquare, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
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

export function SearchHistorySidebar({
  items,
  activeId,
  loading,
  disabled,
  onSelect,
  onNew,
  onDelete,
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
  loggedIn: boolean
  className?: string
  sidebarFooter?: ReactNode
}) {
  return (
    <aside
      className={cn(
        'w-full sm:w-72 shrink-0 border-b sm:border-b-0 sm:border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/40 flex flex-col min-h-0 sm:max-h-[calc(100vh-3.5rem)] sm:sticky sm:top-14',
        className,
      )}
    >
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Historial
        </span>
        <button
          type="button"
          onClick={onNew}
          disabled={disabled || loading || !loggedIn}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
          Nueva
        </button>
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
