export const CONTACTO_ESTADOS = [
  'Sin contactar',
  'Contactado',
  'Volver a llamar',
  'Reunion acordada',
  'Contrato Activo',
  'Proyecto Entregado',
] as const

export type ContactoEstado = (typeof CONTACTO_ESTADOS)[number]

export interface Negocio {
  nombre: string
  /** Calle / vía / bloque (deducido del texto de dirección del resultado). */
  direccion: string
  /** Ciudad o localidad (deducida del texto de dirección del resultado). */
  ciudad: string
  /** País o región final (deducida del texto de dirección del resultado). */
  pais: string
  telefono: string
  correo: string
  sitioWeb: string
  /** Incidencias detectadas al visitar la web (o mensaje si no hay web). */
  problemasDetectados: string
  /** Mejoras sugeridas UX/UI, branding, SEO (o mensaje si no hay web). */
  oportunidades: string
  estado: ContactoEstado
}

/** Fila en tabla UI (id estable para estado y persistencia). */
export type NegocioFila = Negocio & { id: string }

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
