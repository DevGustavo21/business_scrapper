import type { SupabaseClient } from '@supabase/supabase-js'
import type { NegocioFila } from '@/types/business'
import { normalizeSearchCategoryUbicacion, stableBusinessFingerprint } from '@/lib/businessDedupe'
import {
  fetchClientProspectById,
  resetNoInteresadoToSinContactarForUserProspectsMatchingFingerprint,
  updateClientProspectEstado,
} from '@/lib/supabase/clientProspects'
import { resetNoInteresadoToSinContactarInSearchesByFingerprint } from '@/lib/supabase/prospectSearches'

export type ProspectBlacklistRow = {
  id: string
  user_id: string
  fingerprint: string
  nombre: string
  client_prospect_id: string | null
  created_at: string
}

export async function fetchBlacklistFingerprints(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ keys: string[]; error: Error | null }> {
  const { data, error } = await supabase.from('prospect_blacklist').select('fingerprint').eq('user_id', userId)
  if (error) return { keys: [], error: new Error(error.message) }
  const keys = (data ?? [])
    .map(r => (r as { fingerprint?: string }).fingerprint)
    .filter((f): f is string => typeof f === 'string' && f.length > 0)
  return { keys, error: null }
}

export async function fetchExcludeFingerprintsForSearch(
  supabase: SupabaseClient,
  userId: string,
  categoria: string,
  ubicacion: string,
  opts?: { includePriorSearchResults?: boolean },
): Promise<{ keys: string[]; error: Error | null }> {
  const includePrior = opts?.includePriorSearchResults !== false
  const { categoria_norm, ubicacion_norm } = normalizeSearchCategoryUbicacion(categoria, ubicacion)
  const bl = await supabase.from('prospect_blacklist').select('fingerprint').eq('user_id', userId)
  if (bl.error) return { keys: [], error: new Error(bl.error.message) }

  const set = new Set<string>()
  for (const r of bl.data ?? []) {
    if (typeof (r as { fingerprint?: string }).fingerprint === 'string') set.add((r as { fingerprint: string }).fingerprint)
  }

  if (includePrior) {
    const fp = await supabase
      .from('search_result_fingerprints')
      .select('fingerprint')
      .eq('user_id', userId)
      .eq('categoria_norm', categoria_norm)
      .eq('ubicacion_norm', ubicacion_norm)
    if (fp.error) return { keys: [], error: new Error(fp.error.message) }
    for (const r of fp.data ?? []) {
      if (typeof (r as { fingerprint?: string }).fingerprint === 'string')
        set.add((r as { fingerprint: string }).fingerprint)
    }
  }

  return { keys: [...set], error: null }
}

export async function replaceSearchResultFingerprints(
  supabase: SupabaseClient,
  userId: string,
  prospectSearchId: string,
  categoria: string,
  ubicacion: string,
  rows: NegocioFila[],
): Promise<{ error: Error | null }> {
  const { categoria_norm, ubicacion_norm } = normalizeSearchCategoryUbicacion(categoria, ubicacion)
  const del = await supabase.from('search_result_fingerprints').delete().eq('prospect_search_id', prospectSearchId)
  if (del.error) return { error: new Error(del.error.message) }
  const fingerprints = [...new Set(rows.map(r => stableBusinessFingerprint(r)))].filter(Boolean)
  if (fingerprints.length === 0) return { error: null }
  const chunkSize = 80
  for (let i = 0; i < fingerprints.length; i += chunkSize) {
    const slice = fingerprints.slice(i, i + chunkSize)
    const payload = slice.map(fingerprint => ({
      user_id: userId,
      prospect_search_id: prospectSearchId,
      fingerprint,
      categoria_norm,
      ubicacion_norm,
    }))
    const ins = await supabase.from('search_result_fingerprints').insert(payload)
    if (ins.error) return { error: new Error(ins.error.message) }
  }
  return { error: null }
}

export async function upsertProspectBlacklist(
  supabase: SupabaseClient,
  userId: string,
  fingerprint: string,
  nombre: string,
  clientProspectId?: string | null,
): Promise<{ error: Error | null }> {
  await supabase.from('prospect_blacklist').delete().eq('user_id', userId).eq('fingerprint', fingerprint)
  const { error } = await supabase.from('prospect_blacklist').insert({
    user_id: userId,
    fingerprint,
    nombre: nombre.slice(0, 500),
    client_prospect_id: clientProspectId ?? null,
  })
  return { error: error ? new Error(error.message) : null }
}

export async function removeProspectBlacklistByFingerprint(
  supabase: SupabaseClient,
  userId: string,
  fingerprint: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('prospect_blacklist')
    .delete()
    .eq('user_id', userId)
    .eq('fingerprint', fingerprint)
  return { error: error ? new Error(error.message) : null }
}

export async function listProspectBlacklist(
  supabase: SupabaseClient,
): Promise<{ data: ProspectBlacklistRow[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('prospect_blacklist')
    .select('*')
    .order('created_at', { ascending: false })
  return { data: data as ProspectBlacklistRow[] | null, error: error ? new Error(error.message) : null }
}

export async function removeProspectBlacklistById(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('prospect_blacklist').delete().eq('id', id)
  return { error: error ? new Error(error.message) : null }
}

/**
 * Tras quitar una fila de `prospect_blacklist`, alinea el estado de contacto en la app:
 * `client_prospects` vinculado o con la misma huella (propios), y filas equivalentes en JSON de búsquedas.
 */
export async function syncContactEstadoAfterBlacklistRemoval(
  supabase: SupabaseClient,
  userId: string,
  entry: Pick<ProspectBlacklistRow, 'fingerprint' | 'client_prospect_id'>,
): Promise<{ error: Error | null }> {
  const skipIds = new Set<string>()
  if (entry.client_prospect_id) {
    const { data: row, error: fErr } = await fetchClientProspectById(supabase, entry.client_prospect_id)
    if (fErr) return { error: fErr }
    if (row?.estado === 'No interesado') {
      const { error: uErr } = await updateClientProspectEstado(supabase, entry.client_prospect_id, 'Sin contactar')
      if (uErr) return { error: uErr }
    }
    skipIds.add(entry.client_prospect_id)
  }
  const { error: fpErr } = await resetNoInteresadoToSinContactarForUserProspectsMatchingFingerprint(
    supabase,
    userId,
    entry.fingerprint,
    skipIds,
  )
  if (fpErr) return { error: fpErr }
  return resetNoInteresadoToSinContactarInSearchesByFingerprint(supabase, userId, entry.fingerprint)
}
