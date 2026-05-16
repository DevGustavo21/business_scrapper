import type { SupabaseClient } from '@supabase/supabase-js'
import type { NegocioFila } from '@/types/business'
import { negocioFilaForSearchJson } from '@/lib/supabase/clientProspects'
import type { ProspectSearchListItem, ProspectSearchRow, ProspectSearchStatus } from '@/types/prospect-search'

const TABLE = 'prospect_searches'

/** PostgREST PGRST205 / mensajes cuando la tabla aún no existe en el proyecto. */
export function isProspectTableMissingError(message: string): boolean {
  return /prospect_searches|schema cache|PGRST205|Could not find the table/i.test(message)
}

export function messageWhenProspectTableMissing(): string {
  return (
    'Historial: en Supabase → SQL Editor → New query, pega y ejecuta (Run) el script del archivo ' +
    '`supabase/migrations/001_prospect_searches.sql` de tu repo, luego recarga la página. La búsqueda ya funcionó; solo falta crear la tabla.'
  )
}

export function formatProspectSearchError(raw: string | undefined): string {
  const m = raw?.trim() ?? ''
  if (!m) return messageWhenProspectTableMissing()
  if (isProspectTableMissingError(m)) return messageWhenProspectTableMissing()
  return `Historial no guardado: ${m}. La búsqueda sigue en esta sesión.`
}

/** Solo búsquedas creadas por el usuario (no las compartidas por carpeta u otro recurso). */
export async function listProspectSearches(
  supabase: SupabaseClient,
  ownerUserId: string,
): Promise<{ data: ProspectSearchListItem[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, created_at, updated_at, categoria, ubicacion, cantidad_solicitada, status, finish_reason, result_count')
    .eq('user_id', ownerUserId)
    .order('updated_at', { ascending: false })
  return { data: data as ProspectSearchListItem[] | null, error: error ? new Error(error.message) : null }
}

export async function listProspectSearchesByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<{ data: ProspectSearchListItem[] | null; error: Error | null }> {
  if (ids.length === 0) return { data: [], error: null }
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, created_at, updated_at, categoria, ubicacion, cantidad_solicitada, status, finish_reason, result_count')
    .in('id', ids)
    .order('updated_at', { ascending: false })
  return { data: data as ProspectSearchListItem[] | null, error: error ? new Error(error.message) : null }
}

export async function fetchProspectSearch(
  supabase: SupabaseClient,
  id: string,
): Promise<{ data: ProspectSearchRow | null; error: Error | null }> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  return { data: data as ProspectSearchRow | null, error: error ? new Error(error.message) : null }
}

export async function createProspectSearch(
  supabase: SupabaseClient,
  userId: string,
  input: { categoria: string; ubicacion: string; cantidad: number },
): Promise<{ id: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      categoria: input.categoria,
      ubicacion: input.ubicacion,
      cantidad_solicitada: input.cantidad,
      status: 'running' as ProspectSearchStatus,
      finish_reason: null,
    })
    .select('id')
    .single()
  if (error) return { id: null, error: new Error(error.message) }
  return { id: data?.id ?? null, error: null }
}

export async function updateProspectSearchProgress(
  supabase: SupabaseClient,
  id: string,
  negocios: NegocioFila[],
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      negocios: negocios.map(negocioFilaForSearchJson),
      result_count: negocios.length,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  return { error: error ? new Error(error.message) : null }
}

export async function completeProspectSearch(
  supabase: SupabaseClient,
  id: string,
  negocios: NegocioFila[],
  finish: { reason: 'target_met' | 'timeout'; status?: ProspectSearchStatus },
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      negocios: negocios.map(negocioFilaForSearchJson),
      result_count: negocios.length,
      status: finish.status ?? 'completed',
      finish_reason: finish.reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  return { error: error ? new Error(error.message) : null }
}

export async function markProspectSearchError(supabase: SupabaseClient, id: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLE)
    .update({ status: 'error' as ProspectSearchStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error ? new Error(error.message) : null }
}

export async function deleteProspectSearch(supabase: SupabaseClient, id: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  return { error: error ? new Error(error.message) : null }
}
