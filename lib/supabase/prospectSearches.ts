import type { SupabaseClient } from '@supabase/supabase-js'
import { stableBusinessFingerprint } from '@/lib/businessDedupe'
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

/**
 * En búsquedas propias o compartidas visibles, pasa a «Sin contactar» filas en «No interesado»
 * con la misma huella (p. ej. tras quitar de lista negra sin vínculo a client_prospects).
 */
export async function resetNoInteresadoToSinContactarInSearchesByFingerprint(
  supabase: SupabaseClient,
  userId: string,
  fingerprint: string,
): Promise<{ error: Error | null }> {
  const { data: owned, error: oErr } = await supabase.from(TABLE).select('id, negocios').eq('user_id', userId)
  if (oErr) return { error: new Error(oErr.message) }
  const { data: memberships, error: mErr } = await supabase
    .from('collaboration_members')
    .select('resource_id')
    .eq('resource_type', 'prospect_search')
    .eq('user_id', userId)
  if (mErr) return { error: new Error(mErr.message) }
  const sharedIds = [...new Set((memberships ?? []).map(r => r.resource_id as string))].filter(Boolean)
  const ownedIds = new Set((owned ?? []).map(r => r.id as string))

  const { data: folderMemberships, error: fMemErr } = await supabase
    .from('collaboration_members')
    .select('resource_id')
    .eq('resource_type', 'search_folder')
    .eq('user_id', userId)
  if (fMemErr) return { error: new Error(fMemErr.message) }
  const { data: ownedFolders, error: ofErr } = await supabase
    .from('search_folders')
    .select('id')
    .eq('owner_id', userId)
  if (ofErr) return { error: new Error(ofErr.message) }
  const folderIdsForItems = [
    ...new Set([
      ...(ownedFolders ?? []).map(r => r.id as string),
      ...(folderMemberships ?? []).map(r => r.resource_id as string),
    ]),
  ].filter(Boolean)
  let folderSearchIds: string[] = []
  if (folderIdsForItems.length > 0) {
    const { data: sfi, error: sfiErr } = await supabase
      .from('search_folder_items')
      .select('prospect_search_id')
      .in('folder_id', folderIdsForItems)
    if (sfiErr) return { error: new Error(sfiErr.message) }
    folderSearchIds = [...new Set((sfi ?? []).map(r => r.prospect_search_id as string))].filter(Boolean)
  }

  const fromFolderIds = folderSearchIds.filter(id => !ownedIds.has(id) && !sharedIds.includes(id))
  let fromFolders: { id: string; negocios: unknown }[] = []
  if (fromFolderIds.length > 0) {
    const { data: fData, error: fErr } = await supabase.from(TABLE).select('id, negocios').in('id', fromFolderIds)
    if (fErr) return { error: new Error(fErr.message) }
    fromFolders = (fData ?? []) as { id: string; negocios: unknown }[]
  }

  let shared: { id: string; negocios: unknown }[] = []
  if (sharedIds.length > 0) {
    const { data: sData, error: sErr } = await supabase.from(TABLE).select('id, negocios').in('id', sharedIds)
    if (sErr) return { error: new Error(sErr.message) }
    shared = (sData ?? []) as { id: string; negocios: unknown }[]
  }
  const byId = new Map<string, { id: string; negocios: unknown }>()
  for (const r of [...(owned ?? []), ...shared, ...fromFolders]) {
    if (!byId.has(r.id)) byId.set(r.id, r)
  }
  for (const row of byId.values()) {
    const negocios = (Array.isArray(row.negocios) ? row.negocios : []) as NegocioFila[]
    let changed = false
    const next = negocios.map(n => {
      if (n.estado === 'No interesado' && stableBusinessFingerprint(n) === fingerprint) {
        changed = true
        return { ...n, estado: 'Sin contactar' as const }
      }
      return n
    })
    if (changed) {
      const { error: pErr } = await updateProspectSearchProgress(supabase, row.id, next)
      if (pErr) return { error: pErr }
    }
  }
  return { error: null }
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
