'use client'
import { useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink, Heart, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CONTACTO_ESTADOS, type ContactoEstado, type NegocioFila } from '@/types/business'

type ColKey = '#' | 'origen' | keyof NegocioFila | 'prospecto' | 'eliminar'
type Dir = 'asc' | 'desc'

const MID_COLS: { key: keyof NegocioFila; label: string }[] = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'direccion', label: 'Dirección' },
  { key: 'ciudad', label: 'Ciudad' },
  { key: 'pais', label: 'País' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'correo', label: 'Correo' },
  { key: 'sitioWeb', label: 'Sitio web' },
  { key: 'problemasDetectados', label: 'Problemas detectados' },
  { key: 'oportunidades', label: 'Oportunidades' },
]

function CellText({ text, narrow }: { text: string; narrow?: boolean }) {
  const t = text || '—'
  return (
    <span
      className={
        narrow
          ? 'line-clamp-3 text-neutral-600 dark:text-neutral-400 text-xs leading-snug max-w-[min(220px,28vw)]'
          : 'text-neutral-600 dark:text-neutral-400'
      }
      title={t}
    >
      {t}
    </span>
  )
}

function Skeleton({ colCount }: { colCount: number }) {
  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-800">
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 rounded-md bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

export function ResultsTable({
  negocios,
  loading,
  requestedQty,
  onEstadoChange,
  showOrigenColumn,
  prospectHeart,
  deleteRow,
  summaryMode = 'scraped',
}: {
  negocios: NegocioFila[]
  loading: boolean
  requestedQty?: number
  onEstadoChange: (id: string, estado: ContactoEstado) => void
  /** Lista «Clientes prospectos»: muestra si el alta fue manual o desde búsqueda. */
  showOrigenColumn?: boolean
  /** Corazón para marcar / desmarcar prospecto (misma acción en inicio y en listado de prospectos). */
  prospectHeart?: {
    enabled: boolean
    disabled?: boolean
    /** Si true, el corazón solo quita de la lista (todos los visibles ya son prospectos). */
    removeOnly?: boolean
    onToggle: (row: NegocioFila) => void
  }
  /** Eliminar la fila por completo (papelera). La confirmación la hace el padre. */
  deleteRow?: {
    enabled: boolean
    disabled?: boolean
    label?: string
    title?: string
    onDelete: (row: NegocioFila) => void
  }
  /** `list`: textos para listados CRUD/prospectos sin copy de scraping. */
  summaryMode?: 'scraped' | 'list'
}) {
  const cols = useMemo(() => {
    const out: { key: ColKey; label: string }[] = [{ key: '#', label: '#' }]
    if (showOrigenColumn) out.push({ key: 'origen', label: 'Origen' })
    for (const c of MID_COLS) out.push({ key: c.key, label: c.label })
    if (prospectHeart?.enabled) out.push({ key: 'prospecto', label: '¿Prospecto?' })
    out.push({ key: 'estado', label: 'Estado' })
    if (deleteRow?.enabled) out.push({ key: 'eliminar', label: deleteRow.label ?? 'Eliminar' })
    return out
  }, [showOrigenColumn, prospectHeart?.enabled, deleteRow?.enabled, deleteRow?.label])

  const [sortKey, setSortKey] = useState<ColKey>('#')
  const [sortDir, setSortDir] = useState<Dir>('asc')
  const handleSort = (k: ColKey) => {
    if (k === 'eliminar') return
    if (k === 'prospecto' && !prospectHeart?.enabled) return
    if (k === 'origen' && !showOrigenColumn) return
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (sortKey === '#') return sortDir === 'asc' ? [...negocios] : [...negocios].reverse()
    if (sortKey === 'prospecto') {
      return [...negocios].sort((a, b) => {
        const av = a.esProspecto ? 1 : 0
        const bv = b.esProspecto ? 1 : 0
        return sortDir === 'asc' ? av - bv : bv - av
      })
    }
    if (sortKey === 'origen') {
      return [...negocios].sort((a, b) => {
        const av = (a.prospectSource ?? '').toLowerCase()
        const bv = (b.prospectSource ?? '').toLowerCase()
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }
    const sk = sortKey as keyof NegocioFila
    return [...negocios].sort((a, b) => {
      const av = String(a[sk] ?? '')
        .toLowerCase()
      const bv = String(b[sk] ?? '')
        .toLowerCase()
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [negocios, sortKey, sortDir])

  const Icon = ({ col }: { col: ColKey }) =>
    sortKey !== col ? (
      <ChevronsUpDown size={13} className="text-neutral-400" />
    ) : sortDir === 'asc' ? (
      <ChevronUp size={13} className="text-indigo-500" />
    ) : (
      <ChevronDown size={13} className="text-indigo-500" />
    )

  const showSkeletonOnly = loading && negocios.length === 0
  const streamingMore = loading && negocios.length > 0
  const colCount = cols.length
  if (!loading && negocios.length === 0) return null

  const origenLabel = (r: NegocioFila) =>
    r.prospectSource === 'manual' ? 'Manual' : r.prospectSource === 'search' ? 'Búsqueda' : '—'

  return (
    <div className="w-full">
      {(negocios.length > 0 || showSkeletonOnly) && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
          {negocios.length > 0 ? (
            <>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{negocios.length}</span>
              {summaryMode === 'list' ? (
                <>{negocios.length === 1 ? ' registro' : ' registros'}</>
              ) : loading ? (
                <>
                  {requestedQty && requestedQty > negocios.length && (
                    <>
                      {' '}
                      / hasta <span className="font-semibold">{requestedQty}</span> solicitados
                    </>
                  )}
                  <span className="text-neutral-400"> · extrayendo (máx. 4 min)</span>
                </>
              ) : (
                <>{negocios.length === 1 ? ' negocio encontrado' : ' negocios encontrados'}</>
              )}
            </>
          ) : (
            <span className="text-neutral-400">{summaryMode === 'list' ? 'Cargando…' : 'Extrayendo…'}</span>
          )}
        </p>
      )}
      <div className="w-full overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800">
              {cols.map(col => (
                <th
                  key={String(col.key)}
                  onClick={col.key === 'eliminar' ? undefined : () => handleSort(col.key)}
                  className={
                    col.key === 'eliminar'
                      ? 'px-3 py-3 text-left font-semibold text-neutral-600 dark:text-neutral-400 select-none whitespace-nowrap align-bottom'
                      : 'px-3 py-3 text-left font-semibold text-neutral-600 dark:text-neutral-400 cursor-pointer select-none whitespace-nowrap hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors align-bottom'
                  }
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.key !== 'eliminar' && <Icon col={col.key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((n, i) => (
              <tr
                key={n.id}
                className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors align-top"
              >
                {cols.map(col => {
                  if (col.key === '#')
                    return (
                      <td key="#" className="px-3 py-3 text-neutral-400 font-mono text-xs whitespace-nowrap">
                        {i + 1}
                      </td>
                    )
                  if (col.key === 'origen')
                    return (
                      <td key="origen" className="px-3 py-3 text-xs text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                        {origenLabel(n)}
                      </td>
                    )
                  if (col.key === 'prospecto' && prospectHeart?.enabled)
                    return (
                      <td key="prospecto" className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={prospectHeart.disabled}
                          title={
                            prospectHeart.removeOnly
                              ? 'Quitar de clientes prospectos'
                              : n.esProspecto
                                ? 'Quitar de prospectos'
                                : 'Marcar como prospecto'
                          }
                          aria-label={
                            prospectHeart.removeOnly || n.esProspecto
                              ? 'Quitar de clientes prospectos'
                              : 'Marcar como prospecto'
                          }
                          onClick={() => prospectHeart.onToggle(n)}
                          className={cn(
                            'p-2 rounded-xl transition-colors',
                            prospectHeart.disabled
                              ? 'opacity-40 cursor-not-allowed'
                              : 'hover:bg-rose-50 dark:hover:bg-rose-950/30',
                          )}
                        >
                          <Heart
                            size={22}
                            className={cn(
                              (prospectHeart.removeOnly || n.esProspecto) && 'fill-rose-500 text-rose-500',
                              !(prospectHeart.removeOnly || n.esProspecto) && 'text-neutral-300 dark:text-neutral-600',
                            )}
                          />
                        </button>
                      </td>
                    )
                  if (col.key === 'estado')
                    return (
                      <td key="estado" className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <select
                          value={n.estado}
                          onChange={e => onEstadoChange(n.id, e.target.value as ContactoEstado)}
                          onClick={e => e.stopPropagation()}
                          className="max-w-[160px] text-xs rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 py-2 pl-2 pr-6 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                        >
                          {CONTACTO_ESTADOS.map(s => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                    )
                  if (col.key === 'eliminar' && deleteRow?.enabled)
                    return (
                      <td key="eliminar" className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={deleteRow.disabled}
                          title={deleteRow.title ?? 'Eliminar esta fila por completo'}
                          aria-label="Eliminar fila"
                          onClick={() => deleteRow.onDelete(n)}
                          className={cn(
                            'p-2 rounded-xl transition-colors text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30',
                            deleteRow.disabled && 'opacity-40 cursor-not-allowed',
                          )}
                        >
                          <Trash2 size={20} />
                        </button>
                      </td>
                    )
                  const k = col.key as keyof NegocioFila
                  if (k === 'nombre')
                    return (
                      <td key={k} className="px-3 py-3 font-medium text-neutral-900 dark:text-neutral-100 max-w-[160px]">
                        <span className="line-clamp-2" title={n.nombre}>
                          {n.nombre}
                        </span>
                      </td>
                    )
                  if (k === 'sitioWeb')
                    return (
                      <td key={k} className="px-3 py-3 max-w-[140px]">
                        {n.sitioWeb ? (
                          <a
                            href={n.sitioWeb}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 text-xs break-all"
                            onClick={e => e.stopPropagation()}
                          >
                            {n.sitioWeb.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            <ExternalLink size={12} className="shrink-0" />
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    )
                  if (k === 'direccion')
                    return (
                      <td key={k} className="px-3 py-3">
                        <CellText text={n.direccion} narrow />
                      </td>
                    )
                  if (k === 'correo' || k === 'problemasDetectados' || k === 'oportunidades')
                    return (
                      <td key={k} className="px-3 py-3 max-w-[140px]">
                        <CellText text={String(n[k] ?? '')} narrow />
                      </td>
                    )
                  return (
                    <td key={k} className="px-3 py-3 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                      {String(n[k] ?? '') || '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
            {showSkeletonOnly && Array.from({ length: 6 }).map((_, i) => <Skeleton key={`sk-${i}`} colCount={colCount} />)}
            {streamingMore && (
              <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                <td colSpan={colCount} className="px-3 py-3 text-center text-xs text-neutral-500 dark:text-neutral-400">
                  Añadiendo filas conforme se obtienen datos…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
