'use client'

import { Plus, MessageSquare } from 'lucide-react'
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
  loggedIn,
}: {
  items: ProspectSearchListItem[]
  activeId: string | null
  loading: boolean
  disabled?: boolean
  onSelect: (id: string) => void
  onNew: () => void
  loggedIn: boolean
}) {
  return (
    <aside className="w-full sm:w-72 shrink-0 border-b sm:border-b-0 sm:border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/40 flex flex-col min-h-[180px] sm:min-h-0 sm:max-h-[calc(100vh-3.5rem)] sm:sticky sm:top-14">
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
            Inicia sesión para guardar cada búsqueda como un chat. Al volver con el mismo correo recuperarás el historial.
          </p>
        )}
        {loggedIn && items.length === 0 && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 px-2 py-3">
            Aún no hay búsquedas guardadas. Pulsa <strong>Nueva</strong> y lanza una búsqueda.
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {items.map(item => {
            const active = item.id === activeId
            const label = `${item.categoria} · ${item.ubicacion}`
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  disabled={loading}
                  className={`w-full text-left rounded-xl px-3 py-2.5 text-sm transition-colors border ${
                    active
                      ? 'border-indigo-500/60 bg-indigo-50 dark:bg-indigo-950/40 text-neutral-900 dark:text-neutral-100'
                      : 'border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <span className="flex items-start gap-2">
                    <MessageSquare size={16} className="shrink-0 mt-0.5 text-indigo-500" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-medium">{label}</span>
                      <span className="mt-0.5 block text-[11px] text-neutral-500 dark:text-neutral-500">
                        {formatWhen(item.updated_at)} · {item.result_count}/{item.cantidad_solicitada}
                        {item.status === 'running' ? ' · en curso' : ''}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
