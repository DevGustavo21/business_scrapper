'use client'
import { Download } from 'lucide-react'
import { Negocio } from '@/types/business'
interface Props { negocios: Negocio[]; categoria: string; ubicacion: string }
export function ExportButton({ negocios, categoria, ubicacion }: Props) {
  if (negocios.length === 0) return null
  const handleExport = async () => {
    const { exportToExcel } = await import('@/lib/exportExcel')
    exportToExcel(negocios, categoria, ubicacion)
  }
  return (
    <button type="button" onClick={handleExport}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all duration-200">
      <Download size={15} />Exportar a Excel
    </button>
  )
}
