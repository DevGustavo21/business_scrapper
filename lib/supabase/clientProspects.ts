import type { SupabaseClient } from '@supabase/supabase-js'
import { stableBusinessFingerprint } from '@/lib/businessDedupe'
import type { NegocioFila } from '@/types/business'
import type { ClientProspectRow, ClientProspectSource } from '@/types/client-prospect'

const TABLE = 'client_prospects'

export function isClientProspectsTableMissingError(message: string): boolean {
  return /client_prospects|schema cache|PGRST205|Could not find the table/i.test(message)
}

export function messageWhenClientProspectsTableMissing(): string {
  return (
    'Prospectos: ejecuta en Supabase → SQL el archivo `supabase/migrations/002_client_prospects.sql` y recarga.'
  )
}

export function formatClientProspectError(raw: string | undefined): string {
  const m = raw?.trim() ?? ''
  if (!m) return messageWhenClientProspectsTableMissing()
  if (isClientProspectsTableMissingError(m)) return messageWhenClientProspectsTableMissing()
  return m
}

/** Solo campos que se guardan en `prospect_searches.negocios` (sin metadatos de prospecto). */
export function negocioFilaForSearchJson(row: NegocioFila): NegocioFila {
  return {
    id: row.id,
    nombre: row.nombre,
    direccion: row.direccion,
    ciudad: row.ciudad,
    pais: row.pais,
    telefono: row.telefono,
    correo: row.correo,
    sitioWeb: row.sitioWeb,
    problemasDetectados: row.problemasDetectados,
    oportunidades: row.oportunidades,
    estado: row.estado,
  }
}

function negocioToDbCols(n: NegocioFila) {
  return {
    nombre: n.nombre,
    direccion: n.direccion,
    ciudad: n.ciudad,
    pais: n.pais,
    telefono: n.telefono,
    correo: n.correo,
    sitio_web: n.sitioWeb,
    problemas_detectados: n.problemasDetectados,
    oportunidades: n.oportunidades,
    estado: n.estado,
  }
}

/** Mapa search_row_id → id de client_prospects */
export async function fetchProspectMarksForSearch(
  supabase: SupabaseClient,
  searchId: string,
): Promise<{ map: Map<string, string>; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, search_row_id')
    .eq('prospect_search_id', searchId)
    .eq('source', 'search' as ClientProspectSource)
  if (error) return { map: new Map(), error: new Error(error.message) }
  const map = new Map<string, string>()
  for (const r of data ?? []) {
    if (r.search_row_id && r.id) map.set(r.search_row_id, r.id)
  }
  return { map, error: null }
}

export function mergeProspectMarksIntoNegocios(rows: NegocioFila[], marks: Map<string, string>): NegocioFila[] {
  return rows.map(r => {
    const pr = marks.get(r.id)
    if (!pr) return { ...r, esProspecto: false, prospectRecordId: null }
    return { ...r, esProspecto: true, prospectRecordId: pr }
  })
}

export async function insertProspectFromSearch(
  supabase: SupabaseClient,
  userId: string,
  searchId: string,
  row: NegocioFila,
  prospectListId?: string | null,
): Promise<{ id: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      source: 'search' as const,
      prospect_list_id: prospectListId ?? null,
      prospect_search_id: searchId,
      search_row_id: row.id,
      ...negocioToDbCols(row),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) return { id: null, error: new Error(error.message) }
  return { id: data?.id ?? null, error: null }
}

export async function deleteClientProspectById(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  return { error: error ? new Error(error.message) : null }
}

export async function deleteProspectFromSearchRow(
  supabase: SupabaseClient,
  searchId: string,
  searchRowId: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('prospect_search_id', searchId)
    .eq('search_row_id', searchRowId)
    .eq('source', 'search')
  return { error: error ? new Error(error.message) : null }
}

export async function fetchClientProspectById(
  supabase: SupabaseClient,
  id: string,
): Promise<{ data: ClientProspectRow | null; error: Error | null }> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  return { data: data as ClientProspectRow | null, error: error ? new Error(error.message) : null }
}

export async function listAllClientProspects(
  supabase: SupabaseClient,
): Promise<{ data: ClientProspectRow[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('updated_at', { ascending: false })
  return { data: data as ClientProspectRow[] | null, error: error ? new Error(error.message) : null }
}

export async function listClientProspectsForList(
  supabase: SupabaseClient,
  prospectListId: string,
): Promise<{ data: ClientProspectRow[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('prospect_list_id', prospectListId)
    .order('updated_at', { ascending: false })
  return { data: data as ClientProspectRow[] | null, error: error ? new Error(error.message) : null }
}

export async function listManualClientProspects(
  supabase: SupabaseClient,
): Promise<{ data: ClientProspectRow[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('source', 'manual')
    .order('updated_at', { ascending: false })
  return { data: data as ClientProspectRow[] | null, error: error ? new Error(error.message) : null }
}

export async function insertManualClientProspect(
  supabase: SupabaseClient,
  userId: string,
  fields: {
    nombre: string
    direccion: string
    ciudad: string
    pais: string
    telefono: string
    correo: string
    sitioWeb: string
    problemasDetectados: string
    oportunidades: string
    estado: string
  },
  prospectListId?: string | null,
): Promise<{ id: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      source: 'manual' as const,
      prospect_list_id: prospectListId ?? null,
      prospect_search_id: null,
      search_row_id: null,
      nombre: fields.nombre,
      direccion: fields.direccion,
      ciudad: fields.ciudad,
      pais: fields.pais,
      telefono: fields.telefono,
      correo: fields.correo,
      sitio_web: fields.sitioWeb,
      problemas_detectados: fields.problemasDetectados,
      oportunidades: fields.oportunidades,
      estado: fields.estado,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) return { id: null, error: new Error(error.message) }
  return { id: data?.id ?? null, error: null }
}

export async function updateManualClientProspect(
  supabase: SupabaseClient,
  id: string,
  fields: {
    nombre: string
    direccion: string
    ciudad: string
    pais: string
    telefono: string
    correo: string
    sitioWeb: string
    problemasDetectados: string
    oportunidades: string
    estado: string
  },
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      nombre: fields.nombre,
      direccion: fields.direccion,
      ciudad: fields.ciudad,
      pais: fields.pais,
      telefono: fields.telefono,
      correo: fields.correo,
      sitio_web: fields.sitioWeb,
      problemas_detectados: fields.problemasDetectados,
      oportunidades: fields.oportunidades,
      estado: fields.estado,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('source', 'manual')
  return { error: error ? new Error(error.message) : null }
}

export function clientProspectRowToNegocioFila(r: ClientProspectRow): NegocioFila {
  return {
    id: r.id,
    nombre: r.nombre,
    direccion: r.direccion,
    ciudad: r.ciudad,
    pais: r.pais,
    telefono: r.telefono,
    correo: r.correo,
    sitioWeb: r.sitio_web,
    problemasDetectados: r.problemas_detectados,
    oportunidades: r.oportunidades,
    estado: r.estado,
    esProspecto: true,
    prospectRecordId: r.id,
    prospectSource: r.source,
  }
}

export async function updateClientProspectEstado(
  supabase: SupabaseClient,
  prospectId: string,
  estado: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLE)
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', prospectId)
  return { error: error ? new Error(error.message) : null }
}

/** Solo filas en «No interesado» que coincidan en huella (p. ej. al quitar de lista negra). */
export async function resetNoInteresadoToSinContactarForUserProspectsMatchingFingerprint(
  supabase: SupabaseClient,
  userId: string,
  fingerprint: string,
  skipIds?: Set<string>,
): Promise<{ error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, nombre, telefono, correo, direccion, estado')
    .eq('user_id', userId)
    .eq('estado', 'No interesado')
  if (error) return { error: new Error(error.message) }
  for (const r of data ?? []) {
    if (skipIds?.has(r.id)) continue
    const fp = stableBusinessFingerprint({
      nombre: r.nombre,
      telefono: r.telefono,
      correo: r.correo,
      direccion: r.direccion,
    })
    if (fp !== fingerprint) continue
    const { error: uErr } = await updateClientProspectEstado(supabase, r.id, 'Sin contactar')
    if (uErr) return { error: uErr }
  }
  return { error: null }
}

export async function updateClientProspectListId(
  supabase: SupabaseClient,
  prospectId: string,
  prospectListId: string | null,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLE)
    .update({ prospect_list_id: prospectListId, updated_at: new Date().toISOString() })
    .eq('id', prospectId)
  return { error: error ? new Error(error.message) : null }
}
