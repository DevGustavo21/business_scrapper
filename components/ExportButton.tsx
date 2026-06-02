'use client'
import { useTranslations } from 'next-intl'
import { Download } from 'lucide-react'
import type { Negocio } from '@/types/business'

interface Props {
  negocios: Negocio[]
  categoria: string
  etiquetaUbicacion: string
}

export function ExportButton({ negocios, categoria, etiquetaUbicacion }: Props) {
  const t = useTranslations('exportButton')
  const tExcel = useTranslations('excel')
  if (negocios.length === 0) return null
  const handleExport = async () => {
    const { exportToExcel } = await import('@/lib/exportExcel')
    exportToExcel(negocios, categoria, etiquetaUbicacion, {
      sheet: tExcel('sheet'),
      filePrefix: tExcel('filePrefix'),
      headers: {
        index: tExcel('headers.index'),
        name: tExcel('headers.name'),
        address: tExcel('headers.address'),
        city: tExcel('headers.city'),
        country: tExcel('headers.country'),
        phone: tExcel('headers.phone'),
        email: tExcel('headers.email'),
        website: tExcel('headers.website'),
        status: tExcel('headers.status'),
      },
    })
  }
  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all duration-200"
    >
      <Download size={15} />
      {t('label')}
    </button>
  )
}
