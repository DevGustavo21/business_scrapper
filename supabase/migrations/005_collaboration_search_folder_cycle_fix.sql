-- Parche 005: rompe ciclo RLS search_folder_items ↔ prospect_searches ↔ collaboration_members
-- y define collab_resource_owned_by_user si falta.
-- Ejecutar en Supabase SQL Editor después de 004 (o solo este archivo si ya tienes las funciones collab_* de 004).

create or replace function public.collab_resource_owned_by_user(p_resource_type text, p_resource_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case p_resource_type
    when 'search_folder' then exists (
      select 1 from public.search_folders sf
      where sf.id = p_resource_id and sf.owner_id = p_user_id
    )
    when 'prospect_search' then exists (
      select 1 from public.prospect_searches ps
      where ps.id = p_resource_id and ps.user_id = p_user_id
    )
    when 'prospect_list' then exists (
      select 1 from public.prospect_lists pl
      where pl.id = p_resource_id and pl.owner_id = p_user_id
    )
    else false
  end;
$$;

revoke all on function public.collab_resource_owned_by_user(text, uuid, uuid) from public;
grant execute on function public.collab_resource_owned_by_user(text, uuid, uuid) to authenticated;

drop policy if exists search_folder_items_select on public.search_folder_items;
create policy search_folder_items_select on public.search_folder_items
  for select using (
    public.collab_resource_owned_by_user('search_folder', search_folder_items.folder_id, (select auth.uid()))
    or public.collab_user_is_member('search_folder', search_folder_items.folder_id, (select auth.uid()))
  );

drop policy if exists search_folder_items_insert on public.search_folder_items;
create policy search_folder_items_insert on public.search_folder_items
  for insert with check (
    added_by = (select auth.uid())
    and public.collab_resource_owned_by_user('prospect_search', prospect_search_id, (select auth.uid()))
    and (
      public.collab_resource_owned_by_user('search_folder', folder_id, (select auth.uid()))
      or public.collab_member_has_editor_role('search_folder', folder_id, (select auth.uid()))
    )
  );

drop policy if exists search_folder_items_delete on public.search_folder_items;
create policy search_folder_items_delete on public.search_folder_items
  for delete using (
    public.collab_resource_owned_by_user('search_folder', search_folder_items.folder_id, (select auth.uid()))
    or public.collab_member_has_editor_role('search_folder', search_folder_items.folder_id, (select auth.uid()))
  );

drop policy if exists collaboration_members_select on public.collaboration_members;
create policy collaboration_members_select on public.collaboration_members
  for select using (
    user_id = (select auth.uid())
    or invited_by = (select auth.uid())
    or public.collab_user_is_member(collaboration_members.resource_type, collaboration_members.resource_id, (select auth.uid()))
    or public.collab_resource_owned_by_user(collaboration_members.resource_type, collaboration_members.resource_id, (select auth.uid()))
  );

drop policy if exists collaboration_members_delete on public.collaboration_members;
create policy collaboration_members_delete on public.collaboration_members
  for delete using (
    user_id = (select auth.uid())
    or public.collab_resource_owned_by_user(resource_type, resource_id, (select auth.uid()))
  );

drop policy if exists collaboration_invites_insert on public.collaboration_invites;
create policy collaboration_invites_insert on public.collaboration_invites
  for insert with check (
    invited_by = (select auth.uid())
    and exists (
      select 1 from public.profiles inv where inv.id = (select auth.uid())
    )
    and (
      public.collab_member_has_editor_role(collaboration_invites.resource_type, collaboration_invites.resource_id, (select auth.uid()))
      or public.collab_resource_owned_by_user(collaboration_invites.resource_type, collaboration_invites.resource_id, (select auth.uid()))
    )
  );
