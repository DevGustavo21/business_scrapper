'use client'

import { CheckCircle2, Clock, SearchX } from 'lucide-react'
import type { ScrapeStreamDone } from '@/types/business'

export type SearchCompleteSummary = ScrapeStreamDone & {
  categoria: string
  ubicacion: string
}

export function SearchCompleteDialog({
  open,
  summary,
  onClose,
}: {
  open: boolean
  summary: SearchCompleteSummary | null
  onClose: () => void
}) {
  if (!open || !summary) return null

  const { reason, total, requested, categoria, ubicacion } = summary
  const cumplido = reason === 'target_met' && total > 0
  const parcialTiempo = reason === 'timeout' && total > 0 && total < requested
  const vacio = total === 0

  let icon = <CheckCircle2 className="text-emerald-500 shrink-0" size={40} />
  let titulo = 'Búsqueda finalizada'
  let detalle: string

  if (vacio) {
    icon = <SearchX className="text-neutral-400 shrink-0" size={40} />
    titulo = 'Búsqueda finalizada sin resultados'
    detalle =
      'No se pudo extraer ningún negocio con los criterios indicados. Puedes probar otra categoría, ampliar la zona o comprobar la conexión.'
  } else if (cumplido) {
    titulo = 'Búsqueda completada'
    detalle = `Se alcanzó el objetivo: ${total} negocio${total === 1 ? '' : 's'} (pedidos: ${requested}). Ya puedes revisar la tabla y exportar a Excel si lo necesitas.`
  } else if (parcialTiempo) {
    icon = <Clock className="text-amber-500 shrink-0" size={40} />
    titulo = 'Búsqueda finalizada por tiempo'
    detalle = `El tiempo máximo de extracción se agotó antes de llegar a ${requested} negocios. Se guardaron ${total} resultado${total === 1 ? '' : 's'}; puedes exportarlos o lanzar otra búsqueda.`
  } else if (reason === 'timeout' && total >= requested) {
    detalle = `Se obtuvieron ${total} negocio${total === 1 ? '' : 's'} (solicitados: ${requested}). La búsqueda cerró por límite de tiempo con la cuota cubierta.`
  } else {
    detalle = `Resultado: ${total} negocio${total === 1 ? '' : 's'} de ${requested} solicitados. Motivo de cierre: ${reason === 'target_met' ? 'objetivo alcanzado' : 'tiempo máximo'}.`
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-complete-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl p-6 flex flex-col gap-4">
        <div className="flex gap-4 items-start">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 id="search-complete-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {titulo}
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{detalle}</p>
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-500">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">Consulta:</span> {categoria} ·{' '}
              {ubicacion}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
