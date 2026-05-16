-- Los miembros con acceso a una búsqueda (carpeta o recurso compartido) pueden actualizar
-- negocios/resultados (p. ej. estado), igual que pueden leerla. user_id del dueño no cambia.

create or replace function public.prospect_searches_prevent_user_id_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'prospect_searches.user_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists prospect_searches_prevent_user_id_change on public.prospect_searches;
create trigger prospect_searches_prevent_user_id_change
  before update on public.prospect_searches
  for each row execute function public.prospect_searches_prevent_user_id_change();

drop policy if exists prospect_searches_update_own on public.prospect_searches;
drop policy if exists prospect_searches_update on public.prospect_searches;

create policy prospect_searches_update on public.prospect_searches
  for update using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.search_folder_items sfi
      where sfi.prospect_search_id = prospect_searches.id
        and public.collab_user_is_member('search_folder', sfi.folder_id, (select auth.uid()))
    )
    or public.collab_user_is_member('prospect_search', prospect_searches.id, (select auth.uid()))
  );
