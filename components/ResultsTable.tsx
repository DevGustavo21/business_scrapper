'use client'
import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink } from 'lucide-react'
import { Negocio } from '@/types/business'

type Col = keyof Negocio | '#'
type Dir = 'asc' | 'desc'

const COLS: { key: Col; label: string }[] = [
  { key: '#', label: '#' }, { key: 'nombre', label: 'Nombre del negocio' },
  { key: 'ubicacion', label: 'Ubicación' }, { key: 'telefono', label: 'Teléfono' },
  { key: 'correo', label: 'Correo' }, { key: 'sitioWeb', label: 'Sitio Web' },
  { key: 'nombreDueno', label: 'Nombre del dueño' },
]

function Skeleton() {
  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-800">
      {COLS.map(c => <td key={c.key} className="px-4 py-3"><div className="h-4 rounded-md bg-neutral-200 dark:bg-neutral-700 animate-pulse" /></td>)}
    </tr>
  )
}

export function ResultsTable({
  negocios,
  loading,
  requestedQty,
}: {
  negocios: Negocio[]
  loading: boolean
  requestedQty?: number
}) {
  const [sortKey, setSortKey] = useState<Col>('#')
  const [sortDir, setSortDir] = useState<Dir>('asc')
  const handleSort = (k: Col) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc') } }
  const sorted = useMemo(() => {
    if (sortKey === '#') return sortDir === 'asc' ? [...negocios] : [...negocios].reverse()
    return [...negocios].sort((a, b) => {
      const av = (a[sortKey as keyof Negocio] ?? '').toLowerCase()
      const bv = (b[sortKey as keyof Negocio] ?? '').toLowerCase()
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [negocios, sortKey, sortDir])
  const Icon = ({ col }: { col: Col }) => sortKey !== col
    ? <ChevronsUpDown size={13} className="text-neutral-400" />
    : sortDir === 'asc' ? <ChevronUp size={13} className="text-indigo-500" /> : <ChevronDown size={13} className="text-indigo-500" />
  const showSkeletonOnly = loading && negocios.length === 0
  const streamingMore = loading && negocios.length > 0
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
                    <> / hasta <span className="font-semibold">{requestedQty}</span> solicitados</>
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
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800">
              {COLS.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left font-semibold text-neutral-600 dark:text-neutral-400 cursor-pointer select-none whitespace-nowrap hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
                  <span className="flex items-center gap-1">{col.label}<Icon col={col.key} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((n, i) => (
              <tr key={`${n.nombre}-${n.telefono}-${i}`} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                <td className="px-4 py-3 text-neutral-400 font-mono text-xs">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100 max-w-[220px] truncate">{n.nombre}</td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 max-w-[180px] truncate">{n.ubicacion}</td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">{n.telefono}</td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 max-w-[180px] truncate">{n.correo}</td>
                <td className="px-4 py-3 max-w-[160px] truncate">
                  {n.sitioWeb ? <a href={n.sitioWeb} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition-colors">{n.sitioWeb.replace(/^https?:\/\//, '').replace(/\/$/, '')}<ExternalLink size={12} /></a> : null}
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{n.nombreDueno}</td>
              </tr>
            ))}
            {showSkeletonOnly && Array.from({ length: 6 }).map((_, i) => <Skeleton key={`sk-${i}`} />)}
            {streamingMore && (
              <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                <td colSpan={7} className="px-4 py-3 text-center text-xs text-neutral-500 dark:text-neutral-400">
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
