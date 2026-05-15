import type { ContactoEstado } from '@/types/business'

export type ClientProspectSource = 'manual' | 'search'

/** Fila en `public.client_prospects` (PostgREST). */
export interface ClientProspectRow {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  source: ClientProspectSource
  prospect_search_id: string | null
  search_row_id: string | null
  nombre: string
  direccion: string
  ciudad: string
  pais: string
  telefono: string
  correo: string
  sitio_web: string
  problemas_detectados: string
  oportunidades: string
  estado: ContactoEstado
}
