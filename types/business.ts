export interface Negocio {
  nombre: string
  ubicacion: string
  telefono: string
  correo: string
  sitioWeb: string
  nombreDueno: string
}
export interface ScrapeRequest {
  categoria: string
  ubicacion: string
  cantidad: number
}
export interface ScrapeResponse {
  negocios: Negocio[]
  total: number
  error?: string
}

/** Tiempo máximo de una búsqueda en el servidor (ms). */
export const SCRAPE_MAX_MS = 4 * 60 * 1000

/** Payload del evento SSE `done` al terminar el scrape en streaming. */
export type ScrapeStreamDone = {
  reason: 'target_met' | 'timeout'
  total: number
  requested: number
}
