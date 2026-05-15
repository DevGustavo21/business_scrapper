import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationRow } from '@/types/collaboration'

export async function listMyNotifications(
  supabase: SupabaseClient,
  limit = 40,
): Promise<{ data: NotificationRow[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data: data as NotificationRow[] | null, error: error ? new Error(error.message) : null }
}

export async function countUnreadNotifications(
  supabase: SupabaseClient,
): Promise<{ count: number; error: Error | null }> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .is('read_at', null)
  return { count: count ?? 0, error: error ? new Error(error.message) : null }
}

export async function markNotificationRead(supabase: SupabaseClient, id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error ? new Error(error.message) : null }
}

export async function markAllNotificationsRead(supabase: SupabaseClient) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  return { error: error ? new Error(error.message) : null }
}
