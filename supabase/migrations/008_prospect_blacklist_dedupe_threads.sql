-- Lista negra (excluir de búsquedas), huellas por búsqueda (dedupe mismo rubro/ubicación),
-- mensajes y tareas por prospecto (detalle).

-- --- prospect_blacklist -------------------------------------------------------
create table if not exists public.prospect_blacklist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fingerprint text not null,
  nombre text not null default '',
  client_prospect_id uuid references public.client_prospects (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

create index if not exists prospect_blacklist_user_idx on public.prospect_blacklist (user_id, created_at desc);

alter table public.prospect_blacklist enable row level security;

drop policy if exists prospect_blacklist_select_own on public.prospect_blacklist;
create policy prospect_blacklist_select_own on public.prospect_blacklist
  for select using (user_id = (select auth.uid()));

drop policy if exists prospect_blacklist_insert_own on public.prospect_blacklist;
create policy prospect_blacklist_insert_own on public.prospect_blacklist
  for insert with check (user_id = (select auth.uid()));

drop policy if exists prospect_blacklist_delete_own on public.prospect_blacklist;
create policy prospect_blacklist_delete_own on public.prospect_blacklist
  for delete using (user_id = (select auth.uid()));

-- --- search_result_fingerprints (al borrar búsqueda → cascade, negocio puede volver a salir)
create table if not exists public.search_result_fingerprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prospect_search_id uuid not null references public.prospect_searches (id) on delete cascade,
  fingerprint text not null,
  categoria_norm text not null,
  ubicacion_norm text not null,
  unique (user_id, prospect_search_id, fingerprint)
);

create index if not exists search_result_fp_user_loc_idx
  on public.search_result_fingerprints (user_id, categoria_norm, ubicacion_norm);

alter table public.search_result_fingerprints enable row level security;

drop policy if exists search_result_fp_select_own on public.search_result_fingerprints;
create policy search_result_fp_select_own on public.search_result_fingerprints
  for select using (user_id = (select auth.uid()));

drop policy if exists search_result_fp_insert_own on public.search_result_fingerprints;
create policy search_result_fp_insert_own on public.search_result_fingerprints
  for insert with check (user_id = (select auth.uid()));

drop policy if exists search_result_fp_delete_own on public.search_result_fingerprints;
create policy search_result_fp_delete_own on public.search_result_fingerprints
  for delete using (user_id = (select auth.uid()));

-- --- Hilos de mensajes por prospecto ----------------------------------------
create table if not exists public.prospect_thread_messages (
  id uuid primary key default gen_random_uuid(),
  client_prospect_id uuid not null references public.client_prospects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists prospect_thread_msgs_prospect_idx
  on public.prospect_thread_messages (client_prospect_id, created_at desc);

alter table public.prospect_thread_messages enable row level security;

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
            and public.collab_user_is_member(
              'prospect_list',
              cp.prospect_list_id,
              (select auth.uid())
            )
          )
        )
    )
  );

drop policy if exists prospect_thread_messages_insert on public.prospect_thread_messages;
create policy prospect_thread_messages_insert on public.prospect_thread_messages
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.client_prospects cp
      where cp.id = prospect_thread_messages.client_prospect_id
        and (
          cp.user_id = (select auth.uid())
          or (
            cp.prospect_list_id is not null
            and public.collab_user_is_member(
              'prospect_list',
              cp.prospect_list_id,
              (select auth.uid())
            )
          )
        )
    )
  );

-- --- Tareas -------------------------------------------------------------------
create table if not exists public.prospect_tasks (
  id uuid primary key default gen_random_uuid(),
  client_prospect_id uuid not null references public.client_prospects (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  assigned_to uuid references auth.users (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists prospect_tasks_prospect_idx
  on public.prospect_tasks (client_prospect_id, created_at desc);

alter table public.prospect_tasks enable row level security;

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
            and public.collab_user_is_member(
              'prospect_list',
              cp.prospect_list_id,
              (select auth.uid())
            )
          )
        )
    )
  );

drop policy if exists prospect_tasks_insert on public.prospect_tasks;
create policy prospect_tasks_insert on public.prospect_tasks
  for insert with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.client_prospects cp
      where cp.id = prospect_tasks.client_prospect_id
        and (
          cp.user_id = (select auth.uid())
          or (
            cp.prospect_list_id is not null
            and public.collab_member_has_editor_role(
              'prospect_list',
              cp.prospect_list_id,
              (select auth.uid())
            )
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
            and public.collab_member_has_editor_role(
              'prospect_list',
              cp.prospect_list_id,
              (select auth.uid())
            )
          )
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
  );
