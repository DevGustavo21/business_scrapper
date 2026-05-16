import type { SupabaseClient } from '@supabase/supabase-js'

export type ProspectThreadMessageRow = {
  id: string
  client_prospect_id: string
  user_id: string
  body: string
  created_at: string
}

export type ProspectTaskRow = {
  id: string
  client_prospect_id: string
  title: string
  done: boolean
  assigned_to: string | null
  created_by: string
  created_at: string
}

export async function listThreadMessages(
  supabase: SupabaseClient,
  clientProspectId: string,
): Promise<{ data: ProspectThreadMessageRow[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('prospect_thread_messages')
    .select('*')
    .eq('client_prospect_id', clientProspectId)
    .order('created_at', { ascending: true })
  return { data: data as ProspectThreadMessageRow[] | null, error: error ? new Error(error.message) : null }
}

export async function insertThreadMessage(
  supabase: SupabaseClient,
  clientProspectId: string,
  userId: string,
  body: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('prospect_thread_messages').insert({
    client_prospect_id: clientProspectId,
    user_id: userId,
    body: body.trim().slice(0, 8000),
  })
  return { error: error ? new Error(error.message) : null }
}

export async function listProspectTasks(
  supabase: SupabaseClient,
  clientProspectId: string,
): Promise<{ data: ProspectTaskRow[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('prospect_tasks')
    .select('*')
    .eq('client_prospect_id', clientProspectId)
    .order('created_at', { ascending: false })
  return { data: data as ProspectTaskRow[] | null, error: error ? new Error(error.message) : null }
}

export async function insertProspectTask(
  supabase: SupabaseClient,
  clientProspectId: string,
  createdBy: string,
  title: string,
  assignedTo?: string | null,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('prospect_tasks').insert({
    client_prospect_id: clientProspectId,
    title: title.trim().slice(0, 500),
    created_by: createdBy,
    assigned_to: assignedTo ?? null,
  })
  return { error: error ? new Error(error.message) : null }
}

export async function updateProspectTaskDone(
  supabase: SupabaseClient,
  taskId: string,
  done: boolean,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('prospect_tasks').update({ done }).eq('id', taskId)
  return { error: error ? new Error(error.message) : null }
}
