import * as XLSX from 'xlsx'
import { Negocio } from '@/types/business'

export function exportToExcel(negocios: Negocio[], categoria: string, ubicacion: string): void {
  const headers = ['#', 'Nombre del negocio', 'Ubicación', 'Teléfono', 'Correo', 'Sitio Web', 'Nombre del dueño']
  const rows = negocios.map((n, i) => [i + 1, n.nombre, n.ubicacion, n.telefono, n.correo, n.sitioWeb, n.nombreDueno])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[addr]) ws[addr].s = { font: { bold: true } }
  }
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.min(Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length)) + 2, 60)
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Negocios')
  const date = new Date().toISOString().split('T')[0]
  const s = (x: string) => x.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, '').trim().replace(/\s+/g, '_')
  XLSX.writeFile(wb, `negocios_${s(categoria)}_${s(ubicacion)}_${date}.xlsx`)
}
