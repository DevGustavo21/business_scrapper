import * as XLSX from 'xlsx'
import type { Negocio } from '@/types/business'

/**
 * Etiquetas localizadas para el Excel generado.
 *
 * Se inyectan desde quien dispara la exportación (normalmente `ExportButton`,
 * que ya tiene acceso a `useTranslations('excel')`) para que el archivo
 * descargado respete el idioma activo del usuario.
 */
export type ExcelI18n = {
  /** Nombre de la hoja dentro del libro. */
  sheet: string
  /** Prefijo del nombre de archivo. */
  filePrefix: string
  /** Encabezados de columnas, en el orden en que se renderiza la tabla. */
  headers: {
    index: string
    name: string
    address: string
    city: string
    country: string
    phone: string
    email: string
    website: string
    status: string
  }
}

const FALLBACK_I18N: ExcelI18n = {
  sheet: 'Businesses',
  filePrefix: 'businesses',
  headers: {
    index: '#',
    name: 'Name',
    address: 'Address',
    city: 'City',
    country: 'Country',
    phone: 'Phone',
    email: 'Email',
    website: 'Website',
    status: 'Status',
  },
}

export function exportToExcel(
  negocios: Negocio[],
  categoria: string,
  etiquetaUbicacion: string,
  i18n: ExcelI18n = FALLBACK_I18N,
): void {
  /** Observaciones del equipo (problemas/oportunidades) viven solo en la ficha del negocio, no en el Excel. */
  const headers = [
    i18n.headers.index,
    i18n.headers.name,
    i18n.headers.address,
    i18n.headers.city,
    i18n.headers.country,
    i18n.headers.phone,
    i18n.headers.email,
    i18n.headers.website,
    i18n.headers.status,
  ]
  const rows = negocios.map((n, i) => [
    i + 1,
    n.nombre,
    n.direccion,
    n.ciudad,
    n.pais,
    n.telefono,
    n.correo,
    n.sitioWeb,
    n.estado,
  ])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[addr]) ws[addr].s = { font: { bold: true } }
  }
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.min(Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length)) + 2, 56),
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, i18n.sheet)
  const date = new Date().toISOString().split('T')[0]
  const s = (x: string) => x.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, '').trim().replace(/\s+/g, '_')
  XLSX.writeFile(wb, `${i18n.filePrefix}_${s(categoria)}_${s(etiquetaUbicacion)}_${date}.xlsx`)
}
