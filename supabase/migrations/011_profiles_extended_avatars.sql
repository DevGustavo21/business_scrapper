-- Perfil ampliado + bucket público de avatares (ruta {user_id}/...)

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists company text,
  add column if not exists phone text,
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is 'URL pública (p. ej. Storage) de la foto de perfil';
comment on column public.profiles.first_name is 'Nombre';
comment on column public.profiles.last_name is 'Apellido';
comment on column public.profiles.company is 'Empresa';
comment on column public.profiles.phone is 'Teléfono de contacto';

-- --- Storage: avatars (lectura pública, escritura solo en carpeta propia) -------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists avatars_select_public on storage.objects;
create policy avatars_select_public on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- --- RPCs miembros: incluir datos de perfil para UI (avatar, nombre) -----------
-- Cambio de tipo de retorno: en PG hay que DROP antes de volver a crear (error 42P13 con solo REPLACE).
drop function if exists public.list_prospect_list_members(uuid);
drop function if exists public.list_prospect_search_collaborators(uuid);

create function public.list_prospect_list_members(p_list_id uuid)
returns table (
  user_id uuid,
  email text,
  avatar_url text,
  first_name text,
  last_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select distinct m.uid,
    p.email::text,
    p.avatar_url::text,
    p.first_name::text,
    p.last_name::text
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

create function public.list_prospect_search_collaborators(p_search_id uuid)
returns table (
  user_id uuid,
  email text,
  avatar_url text,
  first_name text,
  last_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select distinct m.uid,
    p.email::text,
    p.avatar_url::text,
    p.first_name::text,
    p.last_name::text
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
