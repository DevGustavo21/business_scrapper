'use client'
import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'

const OPTS = [12, 24, 36, 48, 100]
const input = "w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"

interface Props { onSearch: (c: string, u: string, n: number) => void; loading: boolean }

export function SearchPanel({ onSearch, loading }: Props) {
  const [categoria, setCategoria] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [cantidad, setCantidad] = useState(12)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoria.trim() || !ubicacion.trim() || loading) return
    onSearch(categoria.trim(), ubicacion.trim(), cantidad)
  }
  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cat" className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Categoría del negocio</label>
          <input id="cat" type="text" value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ej: dentistas, restaurantes, gimnasios…" disabled={loading} className={input} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ubi" className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Ubicación</label>
          <input id="ubi" type="text" value={ubicacion} onChange={e => setUbicacion(e.target.value)} placeholder="Ej: Managua Nicaragua, Madrid España…" disabled={loading} className={input} />
        </div>
        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <label htmlFor="cant" className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Cantidad de resultados</label>
            <select id="cant" value={cantidad} onChange={e => setCantidad(Number(e.target.value))} disabled={loading} className={input + " cursor-pointer"}>
              {OPTS.map(n => <option key={n} value={n}>{n} negocios</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm opacity-0 select-none">x</span>
            <button type="submit" disabled={loading || !categoria.trim() || !ubicacion.trim()}
              className="px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200 flex items-center gap-2 whitespace-nowrap">
              {loading ? <><Loader2 size={16} className="animate-spin" />Buscando…</> : <><Search size={16} />Buscar</>}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
