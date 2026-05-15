-- Colaboración: perfiles (email), carpetas de búsquedas, listas de prospectos, invitaciones, notificaciones.
-- Ejecutar en Supabase → SQL Editor tras 001 y 002.

-- --- Utilidad email ----------------------------------------------------------

create or replace function public.normalize_email(e text)
returns text
language sql
immutable
as $fn$
  select lower(trim(both from coalesce(e, '')))
$fn$;

-- --- Perfiles (para resolver invitaciones por correo) -------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists profiles_upsert_own on public.profiles;
create policy profiles_upsert_own on public.profiles
  for insert with check ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using ((select auth.uid()) = id);

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, updated_at)
  values (new.id, coalesce(new.email, ''), now())
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profiles on auth.users;
create trigger on_auth_user_created_profiles
  after insert on auth.users
  for each row execute function public.handle_auth_user_profile();

drop trigger if exists on_auth_user_email_profiles on auth.users;
create trigger on_auth_user_email_profiles
  after update of email on auth.users
  for each row execute function public.handle_auth_user_profile();

insert into public.profiles (id, email, updated_at)
select id, coalesce(email, ''), now()
from auth.users
on conflict (id) do update set
  email = excluded.email,
  updated_at = now();

-- --- Carpetas de búsquedas ----------------------------------------------------

create table if not exists public.search_folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists search_folders_owner_idx on public.search_folders (owner_id, updated_at desc);

create table if not exists public.search_folder_items (
  folder_id uuid not null references public.search_folders (id) on delete cascade,
  prospect_search_id uuid not null references public.prospect_searches (id) on delete cascade,
  added_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (folder_id, prospect_search_id)
);

create index if not exists search_folder_items_search_idx on public.search_folder_items (prospect_search_id);

alter table public.search_folders enable row level security;
alter table public.search_folder_items enable row level security;

drop policy if exists search_folders_select on public.search_folders;
create policy search_folders_select on public.search_folders
  for select using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.collaboration_members cm
      where cm.resource_type = 'search_folder'
        and cm.resource_id = search_folders.id
        and cm.user_id = (select auth.uid())
    )
  );

drop policy if exists search_folders_insert on public.search_folders;
create policy search_folders_insert on public.search_folders
  for insert with check (owner_id = (select auth.uid()));

drop policy if exists search_folders_update on public.search_folders;
create policy search_folders_update on public.search_folders
  for update using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.collaboration_members cm
      where cm.resource_type = 'search_folder'
        and cm.resource_id = search_folders.id
        and cm.user_id = (select auth.uid())
        and cm.role = 'editor'
    )
  );

drop policy if exists search_folders_delete on public.search_folders;
create policy search_folders_delete on public.search_folders
  for delete using (owner_id = (select auth.uid()));

drop policy if exists search_folder_items_select on public.search_folder_items;
create policy search_folder_items_select on public.search_folder_items
  for select using (
    exists (
      select 1 from public.search_folders sf
      where sf.id = search_folder_items.folder_id
        and (
          sf.owner_id = (select auth.uid())
          or exists (
            select 1 from public.collaboration_members cm
            where cm.resource_type = 'search_folder'
              and cm.resource_id = sf.id
              and cm.user_id = (select auth.uid())
          )
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
          or exists (
            select 1 from public.collaboration_members cm
            where cm.resource_type = 'search_folder'
              and cm.resource_id = sf.id
              and cm.user_id = (select auth.uid())
              and cm.role = 'editor'
          )
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
          or exists (
            select 1 from public.collaboration_members cm
            where cm.resource_type = 'search_folder'
              and cm.resource_id = sf.id
              and cm.user_id = (select auth.uid())
              and cm.role = 'editor'
          )
        )
    )
  );

-- --- Listas de prospectos -----------------------------------------------------

create table if not exists public.prospect_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospect_lists_owner_idx on public.prospect_lists (owner_id, updated_at desc);

alter table public.client_prospects
  add column if not exists prospect_list_id uuid references public.prospect_lists (id) on delete set null;

alter table public.prospect_lists enable row level security;

drop policy if exists prospect_lists_select on public.prospect_lists;
create policy prospect_lists_select on public.prospect_lists
  for select using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.collaboration_members cm
      where cm.resource_type = 'prospect_list'
        and cm.resource_id = prospect_lists.id
        and cm.user_id = (select auth.uid())
    )
  );

drop policy if exists prospect_lists_insert on public.prospect_lists;
create policy prospect_lists_insert on public.prospect_lists
  for insert with check (owner_id = (select auth.uid()));

drop policy if exists prospect_lists_update on public.prospect_lists;
create policy prospect_lists_update on public.prospect_lists
  for update using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.collaboration_members cm
      where cm.resource_type = 'prospect_list'
        and cm.resource_id = prospect_lists.id
        and cm.user_id = (select auth.uid())
        and cm.role = 'editor'
    )
  );

drop policy if exists prospect_lists_delete on public.prospect_lists;
create policy prospect_lists_delete on public.prospect_lists
  for delete using (owner_id = (select auth.uid()));

-- --- Miembros e invitaciones -------------------------------------------------

create table if not exists public.collaboration_members (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null,
  resource_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'viewer',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint collaboration_members_resource_type_check check (
    resource_type in ('search_folder', 'prospect_search', 'prospect_list')
  ),
  constraint collaboration_members_role_check check (role in ('viewer', 'editor')),
  constraint collaboration_members_unique_member unique (resource_type, resource_id, user_id)
);

create index if not exists collaboration_members_user_idx on public.collaboration_members (user_id);

create table if not exists public.collaboration_invites (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null,
  resource_id uuid not null,
  invitee_email text not null,
  invitee_user_id uuid references auth.users (id) on delete set null,
  invited_by uuid not null references auth.users (id) on delete cascade,
  role text not null default 'viewer',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint collaboration_invites_resource_type_check check (
    resource_type in ('search_folder', 'prospect_search', 'prospect_list')
  ),
  constraint collaboration_invites_role_check check (role in ('viewer', 'editor')),
  constraint collaboration_invites_status_check check (
    status in ('pending', 'accepted', 'declined', 'canceled')
  )
);

create unique index if not exists collaboration_invites_pending_unique
  on public.collaboration_invites (resource_type, resource_id, invitee_email)
  where status = 'pending';

alter table public.collaboration_members enable row level security;
alter table public.collaboration_invites enable row level security;

drop policy if exists collaboration_members_select on public.collaboration_members;
create policy collaboration_members_select on public.collaboration_members
  for select using (
    user_id = (select auth.uid())
    or invited_by = (select auth.uid())
    or exists (
      select 1 from public.collaboration_members cm2
      where cm2.resource_type = collaboration_members.resource_type
        and cm2.resource_id = collaboration_members.resource_id
        and cm2.user_id = (select auth.uid())
    )
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

drop policy if exists collaboration_members_delete on public.collaboration_members;
create policy collaboration_members_delete on public.collaboration_members
  for delete using (
    user_id = (select auth.uid())
    or (
      resource_type = 'search_folder'
      and exists (
        select 1 from public.search_folders sf
        where sf.id = resource_id and sf.owner_id = (select auth.uid())
      )
    )
    or (
      resource_type = 'prospect_search'
      and exists (
        select 1 from public.prospect_searches ps
        where ps.id = resource_id and ps.user_id = (select auth.uid())
      )
    )
    or (
      resource_type = 'prospect_list'
      and exists (
        select 1 from public.prospect_lists pl
        where pl.id = resource_id and pl.owner_id = (select auth.uid())
      )
    )
  );

drop policy if exists collaboration_invites_select on public.collaboration_invites;
create policy collaboration_invites_select on public.collaboration_invites
  for select using (
    invited_by = (select auth.uid())
    or invitee_user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and public.normalize_email(p.email) = collaboration_invites.invitee_email
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
      exists (
        select 1 from public.collaboration_members cm
        where cm.resource_type = collaboration_invites.resource_type
          and cm.resource_id = collaboration_invites.resource_id
          and cm.user_id = (select auth.uid())
          and cm.role = 'editor'
      )
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

drop policy if exists collaboration_invites_update_invitee on public.collaboration_invites;
create policy collaboration_invites_update_invitee on public.collaboration_invites
  for update using (
    invited_by = (select auth.uid())
    or invitee_user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and public.normalize_email(p.email) = collaboration_invites.invitee_email
    )
  );

-- --- Notificaciones -----------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (user_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (user_id = (select auth.uid()));

-- --- Actualizar RLS de prospect_searches / client_prospects --------------------

drop policy if exists prospect_searches_select_own on public.prospect_searches;
drop policy if exists prospect_searches_select on public.prospect_searches;
create policy prospect_searches_select on public.prospect_searches
  for select using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.search_folder_items sfi
      inner join public.collaboration_members cm
        on cm.resource_type = 'search_folder'
        and cm.resource_id = sfi.folder_id
        and cm.user_id = (select auth.uid())
      where sfi.prospect_search_id = prospect_searches.id
    )
    or exists (
      select 1 from public.collaboration_members cm
      where cm.resource_type = 'prospect_search'
        and cm.resource_id = prospect_searches.id
        and cm.user_id = (select auth.uid())
    )
  );

drop policy if exists client_prospects_select_own on public.client_prospects;
drop policy if exists client_prospects_select on public.client_prospects;
create policy client_prospects_select on public.client_prospects
  for select using (
    user_id = (select auth.uid())
    or (
      prospect_list_id is not null
      and exists (
        select 1 from public.collaboration_members cm
        where cm.resource_type = 'prospect_list'
          and cm.resource_id = client_prospects.prospect_list_id
          and cm.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists client_prospects_insert_own on public.client_prospects;
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
      or exists (
        select 1 from public.collaboration_members cm
        where cm.resource_type = 'prospect_list'
          and cm.resource_id = prospect_list_id
          and cm.user_id = (select auth.uid())
          and cm.role = 'editor'
      )
    )
  );

drop policy if exists client_prospects_update_own on public.client_prospects;
drop policy if exists client_prospects_update on public.client_prospects;
create policy client_prospects_update on public.client_prospects
  for update using (
    user_id = (select auth.uid())
    or (
      prospect_list_id is not null
      and exists (
        select 1 from public.collaboration_members cm
        where cm.resource_type = 'prospect_list'
          and cm.resource_id = prospect_list_id
          and cm.user_id = (select auth.uid())
          and cm.role = 'editor'
      )
    )
  );

drop policy if exists client_prospects_delete_own on public.client_prospects;
drop policy if exists client_prospects_delete on public.client_prospects;
create policy client_prospects_delete on public.client_prospects
  for delete using (
    user_id = (select auth.uid())
    or (
      prospect_list_id is not null
      and exists (
        select 1 from public.collaboration_members cm
        where cm.resource_type = 'prospect_list'
          and cm.resource_id = prospect_list_id
          and cm.user_id = (select auth.uid())
          and cm.role = 'editor'
      )
    )
  );

-- --- Triggers notificación ----------------------------------------------------

create or replace function public.collaboration_invites_normalize()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.invitee_email := public.normalize_email(new.invitee_email);
  select id into new.invitee_user_id
  from public.profiles p
  where public.normalize_email(p.email) = new.invitee_email
  limit 1;
  return new;
end;
$$;

drop trigger if exists collaboration_invites_normalize_tr on public.collaboration_invites;
create trigger collaboration_invites_normalize_tr
  before insert or update of invitee_email on public.collaboration_invites
  for each row execute function public.collaboration_invites_normalize();

create or replace function public.notify_collaboration_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.invitee_user_id is not null and new.status = 'pending' then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.invitee_user_id,
      'collab_invite',
      'Invitación para colaborar',
      'Te han invitado a un recurso compartido. Abre Notificaciones o Invitaciones para aceptar.',
      jsonb_build_object(
        'invite_id', new.id,
        'resource_type', new.resource_type,
        'resource_id', new.resource_id,
        'role', new.role,
        'invited_by', new.invited_by
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists collaboration_invites_notify_tr on public.collaboration_invites;
create trigger collaboration_invites_notify_tr
  after insert on public.collaboration_invites
  for each row execute function public.notify_collaboration_invite();

create or replace function public.notify_folder_item_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, data)
  select distinct t.uid,
    'folder_search_added',
    'Búsqueda añadida a carpeta',
    'Se agregó una búsqueda a una carpeta compartida.',
    jsonb_build_object(
      'folder_id', new.folder_id,
      'prospect_search_id', new.prospect_search_id,
      'added_by', new.added_by
    )
  from (
    select sf.owner_id as uid
    from public.search_folders sf
    where sf.id = new.folder_id
      and sf.owner_id <> new.added_by
    union all
    select cm.user_id as uid
    from public.collaboration_members cm
    where cm.resource_type = 'search_folder'
      and cm.resource_id = new.folder_id
      and cm.user_id <> new.added_by
  ) t
  where t.uid is not null;
  return new;
end;
$$;

drop trigger if exists search_folder_items_notify_tr on public.search_folder_items;
create trigger search_folder_items_notify_tr
  after insert on public.search_folder_items
  for each row execute function public.notify_folder_item_added();

create or replace function public.notify_list_prospect_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.prospect_list_id is null then
    return new;
  end if;
  insert into public.notifications (user_id, type, title, body, data)
  select distinct t.uid,
    'list_prospect_added',
    'Nuevo prospecto en lista',
    'Se agregó un prospecto a una lista compartida.',
    jsonb_build_object(
      'prospect_list_id', new.prospect_list_id,
      'client_prospect_id', new.id,
      'added_by', new.user_id
    )
  from (
    select pl.owner_id as uid
    from public.prospect_lists pl
    where pl.id = new.prospect_list_id
      and pl.owner_id <> new.user_id
    union all
    select cm.user_id as uid
    from public.collaboration_members cm
    where cm.resource_type = 'prospect_list'
      and cm.resource_id = new.prospect_list_id
      and cm.user_id <> new.user_id
  ) t
  where t.uid is not null;
  return new;
end;
$$;

drop trigger if exists client_prospects_list_notify_tr on public.client_prospects;
create trigger client_prospects_list_notify_tr
  after insert on public.client_prospects
  for each row execute function public.notify_list_prospect_added();

-- --- RPC aceptar / rechazar invitación ---------------------------------------

create or replace function public.accept_collaboration_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.collaboration_invites%rowtype;
  v_uid uuid := auth.uid();
  v_profile_email text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_inv from public.collaboration_invites where id = p_invite_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_inv.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_pending');
  end if;

  if v_inv.invitee_user_id is not null then
    if v_inv.invitee_user_id <> v_uid then
      return jsonb_build_object('ok', false, 'error', 'wrong_user');
    end if;
  else
    select email into v_profile_email from public.profiles where id = v_uid;
    if v_profile_email is null or public.normalize_email(v_profile_email) <> v_inv.invitee_email then
      return jsonb_build_object('ok', false, 'error', 'email_mismatch');
    end if;
  end if;

  insert into public.collaboration_members (resource_type, resource_id, user_id, role, invited_by)
  values (v_inv.resource_type, v_inv.resource_id, v_uid, v_inv.role, v_inv.invited_by)
  on conflict (resource_type, resource_id, user_id)
  do update set role = excluded.role;

  update public.collaboration_invites
  set status = 'accepted', invitee_user_id = v_uid
  where id = p_invite_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.accept_collaboration_invite(uuid) from public;
grant execute on function public.accept_collaboration_invite(uuid) to authenticated;

create or replace function public.decline_collaboration_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.collaboration_invites%rowtype;
  v_uid uuid := auth.uid();
  v_profile_email text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_inv from public.collaboration_invites where id = p_invite_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_inv.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_pending');
  end if;

  if v_inv.invitee_user_id is not null then
    if v_inv.invitee_user_id <> v_uid then
      return jsonb_build_object('ok', false, 'error', 'wrong_user');
    end if;
  else
    select email into v_profile_email from public.profiles where id = v_uid;
    if v_profile_email is null or public.normalize_email(v_profile_email) <> v_inv.invitee_email then
      return jsonb_build_object('ok', false, 'error', 'email_mismatch');
    end if;
  end if;

  update public.collaboration_invites set status = 'declined', invitee_user_id = coalesce(invitee_user_id, v_uid)
  where id = p_invite_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.decline_collaboration_invite(uuid) from public;
grant execute on function public.decline_collaboration_invite(uuid) to authenticated;
