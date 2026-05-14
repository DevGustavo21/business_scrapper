import type { NegocioFila } from '@/types/business'

export type ProspectSearchStatus = 'running' | 'completed' | 'error'

export interface ProspectSearchRow {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  categoria: string
  ubicacion: string
  cantidad_solicitada: number
  status: ProspectSearchStatus
  finish_reason: 'target_met' | 'timeout' | null
  result_count: number
  negocios: NegocioFila[]
}

export type ProspectSearchListItem = Omit<ProspectSearchRow, 'negocios' | 'user_id'>
