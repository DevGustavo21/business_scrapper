export type CollaborationResourceType = 'search_folder' | 'prospect_search' | 'prospect_list'

export type CollaborationRole = 'viewer' | 'editor'

export interface SearchFolderRow {
  id: string
  owner_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface ProspectListRow {
  id: string
  owner_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface CollaborationInviteRow {
  id: string
  resource_type: CollaborationResourceType
  resource_id: string
  invitee_email: string
  invitee_user_id: string | null
  invited_by: string
  role: CollaborationRole
  status: 'pending' | 'accepted' | 'declined' | 'canceled'
  created_at: string
}

export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}
