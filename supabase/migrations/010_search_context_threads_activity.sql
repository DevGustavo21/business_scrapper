-- Hilos / tareas por fila de búsqueda (sin client_prospect) + cronología de estados + RPC de miembros.

-- --- prospect_thread_messages: prospecto O fila en búsqueda -------------------
alter table public.prospect_thread_messages
  alter column client_prospect_id drop not null;

alter table public.prospect_thread_messages
  add column if not exists prospect_search_id uuid references public.prospect_searches (id) on delete cascade,
  add column if not exists negocio_row_id text;

alter table public.prospect_thread_messages
  drop constraint if exists prospect_thread_messages_context_check;

alter table public.prospect_thread_messages
  add constraint prospect_thread_messages_context_check check (
    (
      client_prospect_id is not null
      and prospect_search_id is null
      and negocio_row_id is null
    )
    or (
      client_prospect_id is null
      and prospect_search_id is not null
      and negocio_row_id is not null
    )
  );

create index if not exists prospect_thread_msgs_search_row_idx
  on public.prospect_thread_messages (prospect_search_id, negocio_row_id, created_at desc);

-- --- prospect_tasks: mismo modelo -------------------------------------------
alter table public.prospect_tasks alter column client_prospect_id drop not null;

alter table public.prospect_tasks
  add column if not exists prospect_search_id uuid references public.prospect_searches (id) on delete cascade,
  add column if not exists negocio_row_id text;

alter table public.prospect_tasks
  drop constraint if exists prospect_tasks_context_check;

alter table public.prospect_tasks
  add constraint prospect_tasks_context_check check (
    (
      client_prospect_id is not null
      and prospect_search_id is null
      and negocio_row_id is null
    )
    or (
      client_prospect_id is null
      and prospect_search_id is not null
      and negocio_row_id is not null
    )
  );

create index if not exists prospect_tasks_search_row_idx
  on public.prospect_tasks (prospect_search_id, negocio_row_id, created_at desc);

-- --- Políticas prospect_thread_messages --------------------------------------
drop policy if exists prospect_thread_messages_select on public.prospect_thread_messages;
create policy prospect_thread_messages_select on public.prospect_thread_messages
  for select using (
    exists (
      select 1 from public.client_prospects cp
      where cp.id = prospect_thread_messages.client_prospect_id
        and (
          cp.user_id = (select auth.uid())
          or (
            cp.prospect_list_id is not null
            and public.collab_user_is_member('prospect_list', cp.prospect_list_id, (select auth.uid()))
          )
        )
    )
    or exists (
      select 1 from public.prospect_searches ps
      where ps.id = prospect_thread_messages.prospect_search_id
        and (
          ps.user_id = (select auth.uid())
          or exists (
            select 1 from public.search_folder_items sfi
            where sfi.prospect_search_id = ps.id
              and public.collab_user_is_member('search_folder', sfi.folder_id, (select auth.uid()))
          )
          or public.collab_user_is_member('prospect_search', ps.id, (select auth.uid()))
        )
    )
  );

drop policy if exists prospect_thread_messages_insert on public.prospect_thread_messages;
create policy prospect_thread_messages_insert on public.prospect_thread_messages
  for insert with check (
    user_id = (select auth.uid())
    and (
      exists (
        select 1 from public.client_prospects cp
        where cp.id = prospect_thread_messages.client_prospect_id
          and (
            cp.user_id = (select auth.uid())
            or (
              cp.prospect_list_id is not null
              and public.collab_user_is_member('prospect_list', cp.prospect_list_id, (select auth.uid()))
            )
          )
      )
      or exists (
        select 1 from public.prospect_searches ps
        where ps.id = prospect_thread_messages.prospect_search_id
          and prospect_thread_messages.negocio_row_id is not null
          and (
            ps.user_id = (select auth.uid())
            or exists (
              select 1 from public.search_folder_items sfi
              where sfi.prospect_search_id = ps.id
                and public.collab_user_is_member('search_folder', sfi.folder_id, (select auth.uid()))
            )
            or public.collab_user_is_member('prospect_search', ps.id, (select auth.uid()))
          )
      )
    )
  );

-- --- Políticas prospect_tasks ------------------------------------------------
drop policy if exists prospect_tasks_select on public.prospect_tasks;
create policy prospect_tasks_select on public.prospect_tasks
  for select using (
    exists (
      select 1 from public.client_prospects cp
      where cp.id = prospect_tasks.client_prospect_id
        and (
          cp.user_id = (select auth.uid())
          or (
            cp.prospect_list_id is not null
            and public.collab_user_is_member('prospect_list', cp.prospect_list_id, (select auth.uid()))
          )
        )
    )
    or exists (
      select 1 from public.prospect_searches ps
      where ps.id = prospect_tasks.prospect_search_id
        and (
          ps.user_id = (select auth.uid())
          or exists (
            select 1 from public.search_folder_items sfi
            where sfi.prospect_search_id = ps.id
              and public.collab_user_is_member('search_folder', sfi.folder_id, (select auth.uid()))
          )
          or public.collab_user_is_member('prospect_search', ps.id, (select auth.uid()))
        )
    )
  );

drop policy if exists prospect_tasks_insert on public.prospect_tasks;
create policy prospect_tasks_insert on public.prospect_tasks
  for insert with check (
    created_by = (select auth.uid())
    and (
      exists (
        select 1 from public.client_prospects cp
        where cp.id = prospect_tasks.client_prospect_id
          and (
            cp.user_id = (select auth.uid())
            or (
              cp.prospect_list_id is not null
              and public.collab_member_has_editor_role('prospect_list', cp.prospect_list_id, (select auth.uid()))
            )
          )
      )
      or exists (
        select 1 from public.prospect_searches ps
        where ps.id = prospect_tasks.prospect_search_id
          and prospect_tasks.negocio_row_id is not null
          and (
            ps.user_id = (select auth.uid())
            or exists (
              select 1 from public.search_folder_items sfi
              where sfi.prospect_search_id = ps.id
                and public.collab_user_is_member('search_folder', sfi.folder_id, (select auth.uid()))
            )
            or public.collab_user_is_member('prospect_search', ps.id, (select auth.uid()))
          )
      )
    )
  );

drop policy if exists prospect_tasks_update on public.prospect_tasks;
create policy prospect_tasks_update on public.prospect_tasks
  for update using (
    exists (
      select 1 from public.client_prospects cp
      where cp.id = prospect_tasks.client_prospect_id
        and (
          cp.user_id = (select auth.uid())
          or (
            cp.prospect_list_id is not null
            and public.collab_member_has_editor_role('prospect_list', cp.prospect_list_id, (select auth.uid()))
          )
        )
    )
    or exists (
      select 1 from public.prospect_searches ps
      where ps.id = prospect_tasks.prospect_search_id
        and (
          ps.user_id = (select auth.uid())
          or exists (
            select 1 from public.search_folder_items sfi
            where sfi.prospect_search_id = ps.id
              and public.collab_user_is_member('search_folder', sfi.folder_id, (select auth.uid()))
          )
          or public.collab_user_is_member('prospect_search', ps.id, (select auth.uid()))
        )
    )
  );

drop policy if exists prospect_tasks_delete on public.prospect_tasks;
create policy prospect_tasks_delete on public.prospect_tasks
  for delete using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.client_prospects cp
      where cp.id = prospect_tasks.client_prospect_id
        and cp.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.prospect_searches ps
      where ps.id = prospect_tasks.prospect_search_id
        and ps.user_id = (select auth.uid())
    )
  );

-- --- Cronología (cambios de estado y hitos opcionales) -----------------------
create table if not exists public.prospect_activity_events (
  id uuid primary key default gen_random_uuid(),
  client_prospect_id uuid references public.client_prospects (id) on delete cascade,
  prospect_search_id uuid references public.prospect_searches (id) on delete cascade,
  negocio_row_id text,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint prospect_activity_events_type_check check (event_type in ('estado_changed', 'note')),
  constraint prospect_activity_events_context_check check (
    (
      client_prospect_id is not null
      and prospect_search_id is null
      and negocio_row_id is null
    )
    or (
      client_prospect_id is null
      and prospect_search_id is not null
      and negocio_row_id is not null
    )
  )
);

create index if not exists prospect_activity_cp_idx
  on public.prospect_activity_events (client_prospect_id, created_at desc);

create index if not exists prospect_activity_search_row_idx
  on public.prospect_activity_events (prospect_search_id, negocio_row_id, created_at desc);

alter table public.prospect_activity_events enable row level security;

drop policy if exists prospect_activity_select on public.prospect_activity_events;
create policy prospect_activity_select on public.prospect_activity_events
  for select using (
    exists (
      select 1 from public.client_prospects cp
      where cp.id = prospect_activity_events.client_prospect_id
        and (
          cp.user_id = (select auth.uid())
          or (
            cp.prospect_list_id is not null
            and public.collab_user_is_member('prospect_list', cp.prospect_list_id, (select auth.uid()))
          )
        )
    )
    or exists (
      select 1 from public.prospect_searches ps
      where ps.id = prospect_activity_events.prospect_search_id
        and (
          ps.user_id = (select auth.uid())
          or exists (
            select 1 from public.search_folder_items sfi
            where sfi.prospect_search_id = ps.id
              and public.collab_user_is_member('search_folder', sfi.folder_id, (select auth.uid()))
          )
          or public.collab_user_is_member('prospect_search', ps.id, (select auth.uid()))
        )
    )
  );

drop policy if exists prospect_activity_insert on public.prospect_activity_events;
create policy prospect_activity_insert on public.prospect_activity_events
  for insert with check (
    user_id = (select auth.uid())
    and (
      exists (
        select 1 from public.client_prospects cp
        where cp.id = prospect_activity_events.client_prospect_id
          and (
            cp.user_id = (select auth.uid())
            or (
              cp.prospect_list_id is not null
              and public.collab_user_is_member('prospect_list', cp.prospect_list_id, (select auth.uid()))
            )
          )
      )
      or exists (
        select 1 from public.prospect_searches ps
        where ps.id = prospect_activity_events.prospect_search_id
          and prospect_activity_events.negocio_row_id is not null
          and (
            ps.user_id = (select auth.uid())
            or exists (
              select 1 from public.search_folder_items sfi
              where sfi.prospect_search_id = ps.id
                and public.collab_user_is_member('search_folder', sfi.folder_id, (select auth.uid()))
            )
            or public.collab_user_is_member('prospect_search', ps.id, (select auth.uid()))
          )
      )
    )
  );

-- --- RPC: miembros de lista compartida (emails desde profiles) ---------------
create or replace function public.list_prospect_list_members(p_list_id uuid)
returns table (user_id uuid, email text)
language sql
security definer
set search_path = public
stable
as $$
  select distinct m.uid, p.email::text
  from (
    select pl.owner_id as uid
    from public.prospect_lists pl
    where pl.id = p_list_id
    union
    select cm.user_id as uid
    from public.collaboration_members cm
    where cm.resource_type = 'prospect_list'
      and cm.resource_id = p_list_id
  ) m
  inner join public.profiles p on p.id = m.uid
  where exists (
    select 1 from public.prospect_lists pl
    where pl.id = p_list_id
      and (
        pl.owner_id = (select auth.uid())
        or public.collab_user_is_member('prospect_list', p_list_id, (select auth.uid()))
      )
  );
$$;

create or replace function public.list_prospect_search_collaborators(p_search_id uuid)
returns table (user_id uuid, email text)
language sql
security definer
set search_path = public
stable
as $$
  select distinct m.uid, p.email::text
  from (
    select ps.user_id as uid from public.prospect_searches ps where ps.id = p_search_id
    union
    select cm.user_id as uid
    from public.collaboration_members cm
    where cm.resource_type = 'prospect_search'
      and cm.resource_id = p_search_id
    union
    select cm.user_id as uid
    from public.search_folder_items sfi
    join public.collaboration_members cm
      on cm.resource_type = 'search_folder'
     and cm.resource_id = sfi.folder_id
    where sfi.prospect_search_id = p_search_id
  ) m
  inner join public.profiles p on p.id = m.uid
  where exists (
    select 1 from public.prospect_searches ps
    where ps.id = p_search_id
      and (
        ps.user_id = (select auth.uid())
        or exists (
          select 1 from public.search_folder_items sfi
          where sfi.prospect_search_id = ps.id
            and public.collab_user_is_member('search_folder', sfi.folder_id, (select auth.uid()))
        )
        or public.collab_user_is_member('prospect_search', ps.id, (select auth.uid()))
      )
  );
$$;

grant execute on function public.list_prospect_list_members(uuid) to authenticated;
grant execute on function public.list_prospect_search_collaborators(uuid) to authenticated;
