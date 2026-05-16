import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContactoEstado } from '@/types/business'

export type WorkspaceThreadTarget =
  | { kind: 'prospect'; clientProspectId: string }
  | { kind: 'search_row'; searchId: string; rowId: string }

export type ProspectThreadMessageRow = {
  id: string
  client_prospect_id: string | null
  prospect_search_id: string | null
  negocio_row_id: string | null
  user_id: string
  body: string
  created_at: string
}

export type ProspectTaskRow = {
  id: string
  client_prospect_id: string | null
  prospect_search_id: string | null
  negocio_row_id: string | null
  title: string
  done: boolean
  assigned_to: string | null
  created_by: string
  created_at: string
}

export type ProspectActivityEventRow = {
  id: string
  client_prospect_id: string | null
  prospect_search_id: string | null
  negocio_row_id: string | null
  user_id: string
  event_type: 'estado_changed' | 'note'
  meta: { from_estado?: string; to_estado?: string }
  created_at: string
}

export type MentionMemberRow = { user_id: string; email: string }

function threadQuery(supabase: SupabaseClient, target: WorkspaceThreadTarget) {
  const q = supabase.from('prospect_thread_messages').select('*')
  if (target.kind === 'prospect') {
    return q.eq('client_prospect_id', target.clientProspectId).is('prospect_search_id', null)
  }
  return q.eq('prospect_search_id', target.searchId).eq('negocio_row_id', target.rowId)
}

function tasksQuery(supabase: SupabaseClient, target: WorkspaceThreadTarget) {
  const q = supabase.from('prospect_tasks').select('*')
  if (target.kind === 'prospect') {
    return q.eq('client_prospect_id', target.clientProspectId).is('prospect_search_id', null)
  }
  return q.eq('prospect_search_id', target.searchId).eq('negocio_row_id', target.rowId)
}

function activityQuery(supabase: SupabaseClient, target: WorkspaceThreadTarget) {
  const q = supabase.from('prospect_activity_events').select('*')
  if (target.kind === 'prospect') {
    return q.eq('client_prospect_id', target.clientProspectId).is('prospect_search_id', null)
  }
  return q.eq('prospect_search_id', target.searchId).eq('negocio_row_id', target.rowId)
}

export async function listThreadMessagesForTarget(
  supabase: SupabaseClient,
  target: WorkspaceThreadTarget,
): Promise<{ data: ProspectThreadMessageRow[] | null; error: Error | null }> {
  const { data, error } = await threadQuery(supabase, target).order('created_at', { ascending: true })
  return { data: data as ProspectThreadMessageRow[] | null, error: error ? new Error(error.message) : null }
}

export async function insertThreadMessageForTarget(
  supabase: SupabaseClient,
  target: WorkspaceThreadTarget,
  userId: string,
  body: string,
): Promise<{ error: Error | null }> {
  const trimmed = body.trim().slice(0, 8000)
  if (!trimmed) return { error: new Error('Mensaje vacío') }
  if (target.kind === 'prospect') {
    const { error } = await supabase.from('prospect_thread_messages').insert({
      client_prospect_id: target.clientProspectId,
      user_id: userId,
      body: trimmed,
    })
    return { error: error ? new Error(error.message) : null }
  }
  const { error } = await supabase.from('prospect_thread_messages').insert({
    client_prospect_id: null,
    prospect_search_id: target.searchId,
    negocio_row_id: target.rowId,
    user_id: userId,
    body: trimmed,
  })
  return { error: error ? new Error(error.message) : null }
}

/** @deprecated use listThreadMessagesForTarget */
export async function listThreadMessages(
  supabase: SupabaseClient,
  clientProspectId: string,
): Promise<{ data: ProspectThreadMessageRow[] | null; error: Error | null }> {
  return listThreadMessagesForTarget(supabase, { kind: 'prospect', clientProspectId })
}

/** @deprecated use insertThreadMessageForTarget */
export async function insertThreadMessage(
  supabase: SupabaseClient,
  clientProspectId: string,
  userId: string,
  body: string,
): Promise<{ error: Error | null }> {
  return insertThreadMessageForTarget(supabase, { kind: 'prospect', clientProspectId }, userId, body)
}

export async function listProspectTasksForTarget(
  supabase: SupabaseClient,
  target: WorkspaceThreadTarget,
): Promise<{ data: ProspectTaskRow[] | null; error: Error | null }> {
  const { data, error } = await tasksQuery(supabase, target).order('created_at', { ascending: false })
  return { data: data as ProspectTaskRow[] | null, error: error ? new Error(error.message) : null }
}

export async function insertProspectTaskForTarget(
  supabase: SupabaseClient,
  target: WorkspaceThreadTarget,
  createdBy: string,
  title: string,
  assignedTo?: string | null,
): Promise<{ error: Error | null }> {
  const t = title.trim().slice(0, 500)
  if (!t) return { error: new Error('Título vacío') }
  if (target.kind === 'prospect') {
    const { error } = await supabase.from('prospect_tasks').insert({
      client_prospect_id: target.clientProspectId,
      title: t,
      created_by: createdBy,
      assigned_to: assignedTo ?? null,
    })
    return { error: error ? new Error(error.message) : null }
  }
  const { error } = await supabase.from('prospect_tasks').insert({
    client_prospect_id: null,
    prospect_search_id: target.searchId,
    negocio_row_id: target.rowId,
    title: t,
    created_by: createdBy,
    assigned_to: assignedTo ?? null,
  })
  return { error: error ? new Error(error.message) : null }
}

/** @deprecated use listProspectTasksForTarget */
export async function listProspectTasks(
  supabase: SupabaseClient,
  clientProspectId: string,
): Promise<{ data: ProspectTaskRow[] | null; error: Error | null }> {
  return listProspectTasksForTarget(supabase, { kind: 'prospect', clientProspectId })
}

/** @deprecated use insertProspectTaskForTarget */
export async function insertProspectTask(
  supabase: SupabaseClient,
  clientProspectId: string,
  createdBy: string,
  title: string,
  assignedTo?: string | null,
): Promise<{ error: Error | null }> {
  return insertProspectTaskForTarget(supabase, { kind: 'prospect', clientProspectId }, createdBy, title, assignedTo)
}

export async function updateProspectTaskDone(
  supabase: SupabaseClient,
  taskId: string,
  done: boolean,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('prospect_tasks').update({ done }).eq('id', taskId)
  return { error: error ? new Error(error.message) : null }
}

export async function updateProspectTaskAssignee(
  supabase: SupabaseClient,
  taskId: string,
  assignedTo: string | null,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('prospect_tasks').update({ assigned_to: assignedTo }).eq('id', taskId)
  return { error: error ? new Error(error.message) : null }
}

export async function listActivityForTarget(
  supabase: SupabaseClient,
  target: WorkspaceThreadTarget,
): Promise<{ data: ProspectActivityEventRow[] | null; error: Error | null }> {
  const { data, error } = await activityQuery(supabase, target).order('created_at', { ascending: false }).limit(80)
  return { data: data as ProspectActivityEventRow[] | null, error: error ? new Error(error.message) : null }
}

export async function insertEstadoChangedEvent(
  supabase: SupabaseClient,
  userId: string,
  fromEstado: ContactoEstado,
  toEstado: ContactoEstado,
  target: WorkspaceThreadTarget,
): Promise<{ error: Error | null }> {
  if (fromEstado === toEstado) return { error: null }
  const meta = { from_estado: fromEstado, to_estado: toEstado }
  if (target.kind === 'prospect') {
    const { error } = await supabase.from('prospect_activity_events').insert({
      client_prospect_id: target.clientProspectId,
      user_id: userId,
      event_type: 'estado_changed',
      meta,
    })
    return { error: error ? new Error(error.message) : null }
  }
  const { error } = await supabase.from('prospect_activity_events').insert({
    client_prospect_id: null,
    prospect_search_id: target.searchId,
    negocio_row_id: target.rowId,
    user_id: userId,
    event_type: 'estado_changed',
    meta,
  })
  return { error: error ? new Error(error.message) : null }
}
