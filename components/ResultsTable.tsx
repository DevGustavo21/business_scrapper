'use client'
import { useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink } from 'lucide-react'
import { CONTACTO_ESTADOS, type ContactoEstado, type Negocio, type NegocioFila } from '@/types/business'

type Col = keyof NegocioFila | '#'
type Dir = 'asc' | 'desc'

const COLS: { key: Col; label: string }[] = [
  { key: '#', label: '#' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'direccion', label: 'Dirección' },
  { key: 'ciudad', label: 'Ciudad' },
  { key: 'pais', label: 'País' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'correo', label: 'Correo' },
  { key: 'sitioWeb', label: 'Sitio web' },
  { key: 'problemasDetectados', label: 'Problemas detectados' },
  { key: 'oportunidades', label: 'Oportunidades' },
  { key: 'estado', label: 'Estado' },
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

function Skeleton() {
  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-800">
      {COLS.map(c => (
        <td key={c.key} className="px-3 py-3">
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
}: {
  negocios: NegocioFila[]
  loading: boolean
  requestedQty?: number
  onEstadoChange: (id: string, estado: ContactoEstado) => void
}) {
  const [sortKey, setSortKey] = useState<Col>('#')
  const [sortDir, setSortDir] = useState<Dir>('asc')
  const handleSort = (k: Col) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(k)
      setSortDir('asc')
    }
  }
  const sorted = useMemo(() => {
    if (sortKey === '#') return sortDir === 'asc' ? [...negocios] : [...negocios].reverse()
    return [...negocios].sort((a, b) => {
      const av = String(a[sortKey as keyof NegocioFila] ?? '')
        .toLowerCase()
      const bv = String(b[sortKey as keyof NegocioFila] ?? '')
        .toLowerCase()
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [negocios, sortKey, sortDir])
  const Icon = ({ col }: { col: Col }) =>
    sortKey !== col ? (
      <ChevronsUpDown size={13} className="text-neutral-400" />
    ) : sortDir === 'asc' ? (
      <ChevronUp size={13} className="text-indigo-500" />
    ) : (
      <ChevronDown size={13} className="text-indigo-500" />
    )
  const showSkeletonOnly = loading && negocios.length === 0
  const streamingMore = loading && negocios.length > 0
  const colCount = COLS.length
  if (!loading && negocios.length === 0) return null
  return (
    <div className="w-full">
      {(negocios.length > 0 || showSkeletonOnly) && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
          {negocios.length > 0 ? (
            <>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{negocios.length}</span>
              {loading ? (
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
            <span className="text-neutral-400">Extrayendo…</span>
          )}
        </p>
      )}
      <div className="w-full overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800">
              {COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-3 text-left font-semibold text-neutral-600 dark:text-neutral-400 cursor-pointer select-none whitespace-nowrap hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors align-bottom"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <Icon col={col.key} />
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
                <td className="px-3 py-3 text-neutral-400 font-mono text-xs whitespace-nowrap">{i + 1}</td>
                <td className="px-3 py-3 font-medium text-neutral-900 dark:text-neutral-100 max-w-[160px]">
                  <span className="line-clamp-2" title={n.nombre}>
                    {n.nombre}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <CellText text={n.direccion} narrow />
                </td>
                <td className="px-3 py-3 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">{n.ciudad || '—'}</td>
                <td className="px-3 py-3 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">{n.pais || '—'}</td>
                <td className="px-3 py-3 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">{n.telefono || '—'}</td>
                <td className="px-3 py-3 max-w-[140px]">
                  <CellText text={n.correo} narrow />
                </td>
                <td className="px-3 py-3 max-w-[140px]">
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
                <td className="px-3 py-3">
                  <CellText text={n.problemasDetectados} narrow />
                </td>
                <td className="px-3 py-3">
                  <CellText text={n.oportunidades} narrow />
                </td>
                <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
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
              </tr>
            ))}
            {showSkeletonOnly && Array.from({ length: 6 }).map((_, i) => <Skeleton key={`sk-${i}`} />)}
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
