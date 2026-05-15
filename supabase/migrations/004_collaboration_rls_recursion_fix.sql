-- Parche si ya aplicaste 003 y ves: "infinite recursion detected in policy for relation collaboration_members"
-- Ejecutar una vez en Supabase SQL Editor (no hace falta si instalas desde 003 actualizado desde cero).

create or replace function public.collab_user_is_member(p_resource_type text, p_resource_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.collaboration_members cm
    where cm.resource_type = p_resource_type
      and cm.resource_id = p_resource_id
      and cm.user_id = p_user_id
  );
$$;

create or replace function public.collab_member_has_editor_role(p_resource_type text, p_resource_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.collaboration_members cm
    where cm.resource_type = p_resource_type
      and cm.resource_id = p_resource_id
      and cm.user_id = p_user_id
      and cm.role = 'editor'
  );
$$;

revoke all on function public.collab_user_is_member(text, uuid, uuid) from public;
grant execute on function public.collab_user_is_member(text, uuid, uuid) to authenticated;

revoke all on function public.collab_member_has_editor_role(text, uuid, uuid) from public;
grant execute on function public.collab_member_has_editor_role(text, uuid, uuid) to authenticated;

drop policy if exists search_folders_select on public.search_folders;
create policy search_folders_select on public.search_folders
  for select using (
    owner_id = (select auth.uid())
    or public.collab_user_is_member('search_folder', search_folders.id, (select auth.uid()))
  );

drop policy if exists search_folders_update on public.search_folders;
create policy search_folders_update on public.search_folders
  for update using (
    owner_id = (select auth.uid())
    or public.collab_member_has_editor_role('search_folder', search_folders.id, (select auth.uid()))
  );

drop policy if exists search_folder_items_select on public.search_folder_items;
create policy search_folder_items_select on public.search_folder_items
  for select using (
    exists (
      select 1 from public.search_folders sf
      where sf.id = search_folder_items.folder_id
        and (
          sf.owner_id = (select auth.uid())
          or public.collab_user_is_member('search_folder', sf.id, (select auth.uid()))
        )
    )
  );

drop policy if exists search_folder_items_insert on public.search_folder_items;
create policy search_folder_items_insert on public.search_folder_items
  for insert with check (
    added_by = (select auth.uid())
    and exists (
      select 1 from public.prospect_searches ps
      where ps.id = prospect_search_id
        and ps.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.search_folders sf
      where sf.id = folder_id
        and (
          sf.owner_id = (select auth.uid())
          or public.collab_member_has_editor_role('search_folder', sf.id, (select auth.uid()))
        )
    )
  );

drop policy if exists search_folder_items_delete on public.search_folder_items;
create policy search_folder_items_delete on public.search_folder_items
  for delete using (
    exists (
      select 1 from public.search_folders sf
      where sf.id = search_folder_items.folder_id
        and (
          sf.owner_id = (select auth.uid())
          or public.collab_member_has_editor_role('search_folder', sf.id, (select auth.uid()))
        )
    )
  );

drop policy if exists prospect_lists_select on public.prospect_lists;
create policy prospect_lists_select on public.prospect_lists
  for select using (
    owner_id = (select auth.uid())
    or public.collab_user_is_member('prospect_list', prospect_lists.id, (select auth.uid()))
  );

drop policy if exists prospect_lists_update on public.prospect_lists;
create policy prospect_lists_update on public.prospect_lists
  for update using (
    owner_id = (select auth.uid())
    or public.collab_member_has_editor_role('prospect_list', prospect_lists.id, (select auth.uid()))
  );

drop policy if exists collaboration_members_select on public.collaboration_members;
create policy collaboration_members_select on public.collaboration_members
  for select using (
    user_id = (select auth.uid())
    or invited_by = (select auth.uid())
    or public.collab_user_is_member(collaboration_members.resource_type, collaboration_members.resource_id, (select auth.uid()))
    or (
      collaboration_members.resource_type = 'search_folder'
      and exists (
        select 1 from public.search_folders sf
        where sf.id = collaboration_members.resource_id
          and sf.owner_id = (select auth.uid())
      )
    )
    or (
      collaboration_members.resource_type = 'prospect_search'
      and exists (
        select 1 from public.prospect_searches ps
        where ps.id = collaboration_members.resource_id
          and ps.user_id = (select auth.uid())
      )
    )
    or (
      collaboration_members.resource_type = 'prospect_list'
      and exists (
        select 1 from public.prospect_lists pl
        where pl.id = collaboration_members.resource_id
          and pl.owner_id = (select auth.uid())
      )
    )
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
      or (
        collaboration_invites.resource_type = 'search_folder'
        and exists (
          select 1 from public.search_folders sf
          where sf.id = collaboration_invites.resource_id
            and sf.owner_id = (select auth.uid())
        )
      )
      or (
        collaboration_invites.resource_type = 'prospect_search'
        and exists (
          select 1 from public.prospect_searches ps
          where ps.id = collaboration_invites.resource_id
            and ps.user_id = (select auth.uid())
        )
      )
      or (
        collaboration_invites.resource_type = 'prospect_list'
        and exists (
          select 1 from public.prospect_lists pl
          where pl.id = collaboration_invites.resource_id
            and pl.owner_id = (select auth.uid())
        )
      )
    )
  );

drop policy if exists prospect_searches_select on public.prospect_searches;
create policy prospect_searches_select on public.prospect_searches
  for select using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.search_folder_items sfi
      where sfi.prospect_search_id = prospect_searches.id
        and public.collab_user_is_member('search_folder', sfi.folder_id, (select auth.uid()))
    )
    or public.collab_user_is_member('prospect_search', prospect_searches.id, (select auth.uid()))
  );

drop policy if exists client_prospects_select on public.client_prospects;
create policy client_prospects_select on public.client_prospects
  for select using (
    user_id = (select auth.uid())
    or (
      prospect_list_id is not null
      and public.collab_user_is_member('prospect_list', client_prospects.prospect_list_id, (select auth.uid()))
    )
  );

drop policy if exists client_prospects_insert on public.client_prospects;
create policy client_prospects_insert on public.client_prospects
  for insert with check (
    user_id = (select auth.uid())
    and (
      prospect_list_id is null
      or exists (
        select 1 from public.prospect_lists pl
        where pl.id = prospect_list_id
          and pl.owner_id = (select auth.uid())
      )
      or public.collab_member_has_editor_role('prospect_list', prospect_list_id, (select auth.uid()))
    )
  );

drop policy if exists client_prospects_update on public.client_prospects;
create policy client_prospects_update on public.client_prospects
  for update using (
    user_id = (select auth.uid())
    or (
      prospect_list_id is not null
      and public.collab_member_has_editor_role('prospect_list', prospect_list_id, (select auth.uid()))
    )
  );

drop policy if exists client_prospects_delete on public.client_prospects;
create policy client_prospects_delete on public.client_prospects
  for delete using (
    user_id = (select auth.uid())
    or (
      prospect_list_id is not null
      and public.collab_member_has_editor_role('prospect_list', prospect_list_id, (select auth.uid()))
    )
  );
