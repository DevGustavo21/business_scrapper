import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CollaborationInviteRow,
  CollaborationResourceType,
  CollaborationRole,
  ProspectListRow,
  SearchFolderRow,
} from '@/types/collaboration'

export function normalizeShareEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function listSearchFoldersForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: SearchFolderRow[]; error: Error | null }> {
  const { data: owned, error: e1 } = await supabase
    .from('search_folders')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false })

  if (e1) return { data: [], error: new Error(e1.message) }

  const { data: memberships, error: e2 } = await supabase
    .from('collaboration_members')
    .select('resource_id')
    .eq('resource_type', 'search_folder')
    .eq('user_id', userId)

  if (e2) return { data: owned as SearchFolderRow[], error: null }

  const sharedIds = [...new Set((memberships ?? []).map(r => r.resource_id as string))].filter(id => id)
  let shared: SearchFolderRow[] = []
  if (sharedIds.length > 0) {
    const { data: sf, error: e3 } = await supabase.from('search_folders').select('*').in('id', sharedIds)
    if (e3) return { data: owned as SearchFolderRow[], error: null }
    shared = (sf ?? []) as SearchFolderRow[]
  }

  const merged = new Map<string, SearchFolderRow>()
  for (const r of [...(owned as SearchFolderRow[]), ...shared]) merged.set(r.id, r)
  return { data: [...merged.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)), error: null }
}

export async function createSearchFolder(supabase: SupabaseClient, userId: string, name: string) {
  const { data, error } = await supabase
    .from('search_folders')
    .insert({
      owner_id: userId,
      name: name.trim(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()
  return { folder: data as SearchFolderRow | null, error: error ? new Error(error.message) : null }
}

export async function renameSearchFolder(supabase: SupabaseClient, folderId: string, name: string) {
  const { error } = await supabase
    .from('search_folders')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', folderId)
  return { error: error ? new Error(error.message) : null }
}

export async function deleteSearchFolder(supabase: SupabaseClient, folderId: string) {
  const { error } = await supabase.from('search_folders').delete().eq('id', folderId)
  return { error: error ? new Error(error.message) : null }
}

export async function listFolderSearchIds(supabase: SupabaseClient, folderId: string) {
  const { data, error } = await supabase
    .from('search_folder_items')
    .select('prospect_search_id, created_at')
    .eq('folder_id', folderId)
    .order('created_at', { ascending: false })
  return {
    ids: (data ?? []).map(r => r.prospect_search_id as string),
    error: error ? new Error(error.message) : null,
  }
}

export async function addSearchToFolder(
  supabase: SupabaseClient,
  userId: string,
  folderId: string,
  prospectSearchId: string,
) {
  const { error } = await supabase.from('search_folder_items').insert({
    folder_id: folderId,
    prospect_search_id: prospectSearchId,
    added_by: userId,
  })
  return { error: error ? new Error(error.message) : null }
}

export async function removeSearchFromFolder(supabase: SupabaseClient, folderId: string, prospectSearchId: string) {
  const { error } = await supabase
    .from('search_folder_items')
    .delete()
    .eq('folder_id', folderId)
    .eq('prospect_search_id', prospectSearchId)
  return { error: error ? new Error(error.message) : null }
}

export async function listProspectListsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: ProspectListRow[]; error: Error | null }> {
  const { data: owned, error: e1 } = await supabase
    .from('prospect_lists')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false })
  if (e1) return { data: [], error: new Error(e1.message) }

  const { data: memberships, error: e2 } = await supabase
    .from('collaboration_members')
    .select('resource_id')
    .eq('resource_type', 'prospect_list')
    .eq('user_id', userId)

  if (e2) return { data: owned as ProspectListRow[], error: null }

  const sharedIds = [...new Set((memberships ?? []).map(r => r.resource_id as string))].filter(Boolean)
  let shared: ProspectListRow[] = []
  if (sharedIds.length > 0) {
    const { data: lists, error: e3 } = await supabase.from('prospect_lists').select('*').in('id', sharedIds)
    if (!e3) shared = (lists ?? []) as ProspectListRow[]
  }

  const merged = new Map<string, ProspectListRow>()
  for (const r of [...(owned as ProspectListRow[]), ...shared]) merged.set(r.id, r)
  return { data: [...merged.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)), error: null }
}

export async function createProspectList(supabase: SupabaseClient, userId: string, name: string) {
  const { data, error } = await supabase
    .from('prospect_lists')
    .insert({
      owner_id: userId,
      name: name.trim(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()
  return { list: data as ProspectListRow | null, error: error ? new Error(error.message) : null }
}

export async function renameProspectList(supabase: SupabaseClient, listId: string, name: string) {
  const { error } = await supabase
    .from('prospect_lists')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', listId)
  return { error: error ? new Error(error.message) : null }
}

export async function deleteProspectList(supabase: SupabaseClient, listId: string) {
  const { error } = await supabase.from('prospect_lists').delete().eq('id', listId)
  return { error: error ? new Error(error.message) : null }
}

export async function insertCollaborationInvite(
  supabase: SupabaseClient,
  input: {
    resourceType: CollaborationResourceType
    resourceId: string
    inviteeEmail: string
    role: CollaborationRole
    invitedBy: string
  },
): Promise<{ inviteeUserId: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('collaboration_invites')
    .insert({
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      invitee_email: normalizeShareEmail(input.inviteeEmail),
      invited_by: input.invitedBy,
      role: input.role,
      status: 'pending',
    })
    .select('invitee_user_id')
    .single()
  if (error) return { inviteeUserId: null, error: new Error(error.message) }
  return { inviteeUserId: (data?.invitee_user_id as string | null) ?? null, error: null }
}

export async function listPendingInvitesForMe(supabase: SupabaseClient): Promise<{
  data: CollaborationInviteRow[] | null
  error: Error | null
}> {
  const { data, error } = await supabase
    .from('collaboration_invites')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  return { data: data as CollaborationInviteRow[] | null, error: error ? new Error(error.message) : null }
}

export async function acceptCollaborationInviteRpc(supabase: SupabaseClient, inviteId: string) {
  const { data, error } = await supabase.rpc('accept_collaboration_invite', { p_invite_id: inviteId })
  if (error) return { ok: false as const, error: new Error(error.message) }
  const j = data as { ok?: boolean; error?: string }
  if (!j?.ok) return { ok: false as const, error: new Error(j?.error ?? 'reject') }
  return { ok: true as const, error: null }
}

export async function declineCollaborationInviteRpc(supabase: SupabaseClient, inviteId: string) {
  const { data, error } = await supabase.rpc('decline_collaboration_invite', { p_invite_id: inviteId })
  if (error) return { ok: false as const, error: new Error(error.message) }
  const j = data as { ok?: boolean; error?: string }
  if (!j?.ok) return { ok: false as const, error: new Error(j?.error ?? 'reject') }
  return { ok: true as const, error: null }
}
