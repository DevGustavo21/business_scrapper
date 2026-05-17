-- Notificaciones cuando alguien es @mencionado en un mensaje del hilo de trabajo.

create or replace function public.extract_mention_emails(p_body text)
returns setof text
language sql
immutable
as $$
  select public.normalize_email(substring(tok from 2))
  from regexp_split_to_table(coalesce(p_body, ''), '\s+') as tok
  where tok ~ '^@[^@\s]+@[^@\s]+\.[^@\s]+$'
    and length(substring(tok from 2)) > 0
$$;

create or replace function public.notify_thread_message_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_label text;
  v_context_title text;
  v_snip text;
begin
  select coalesce(nullif(trim(p.email), ''), 'Alguien')
  into v_sender_label
  from public.profiles p
  where p.id = new.user_id;

  v_snip := left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 120);

  if new.client_prospect_id is not null then
    select coalesce(nullif(trim(cp.nombre), ''), 'Prospecto')
    into v_context_title
    from public.client_prospects cp
    where cp.id = new.client_prospect_id;

    insert into public.notifications (user_id, type, title, body, data)
    select distinct p.id,
      'thread_mention',
      v_sender_label || ' te mencionó',
      'En «' || v_context_title || '»: ' || v_snip,
      jsonb_build_object(
        'client_prospect_id', new.client_prospect_id,
        'message_id', new.id,
        'mentioned_by', new.user_id
      )
    from public.extract_mention_emails(new.body) me
    inner join public.profiles p on public.normalize_email(p.email) = me
    where p.id <> new.user_id
      and exists (
        select 1
        from public.client_prospects cp
        where cp.id = new.client_prospect_id
          and (
            (
              cp.prospect_list_id is null
              and cp.user_id = p.id
            )
            or (
              cp.prospect_list_id is not null
              and p.id in (
                select pl.owner_id
                from public.prospect_lists pl
                where pl.id = cp.prospect_list_id
                union
                select cm.user_id
                from public.collaboration_members cm
                where cm.resource_type = 'prospect_list'
                  and cm.resource_id = cp.prospect_list_id
              )
            )
          )
      );

  elsif new.prospect_search_id is not null and new.negocio_row_id is not null then
    select coalesce(
      nullif(trim(concat_ws(' · ', nullif(trim(ps.categoria), ''), nullif(trim(ps.ubicacion), ''))), ''),
      'Búsqueda compartida'
    )
    into v_context_title
    from public.prospect_searches ps
    where ps.id = new.prospect_search_id;

    insert into public.notifications (user_id, type, title, body, data)
    select distinct p.id,
      'thread_mention',
      v_sender_label || ' te mencionó',
      'En «' || v_context_title || '»: ' || v_snip,
      jsonb_build_object(
        'prospect_search_id', new.prospect_search_id,
        'negocio_row_id', new.negocio_row_id,
        'message_id', new.id,
        'mentioned_by', new.user_id
      )
    from public.extract_mention_emails(new.body) me
    inner join public.profiles p on public.normalize_email(p.email) = me
    where p.id <> new.user_id
      and p.id in (
        select ps.user_id
        from public.prospect_searches ps
        where ps.id = new.prospect_search_id
        union
        select cm.user_id
        from public.collaboration_members cm
        where cm.resource_type = 'prospect_search'
          and cm.resource_id = new.prospect_search_id
        union
        select cm.user_id
        from public.search_folder_items sfi
        join public.collaboration_members cm
          on cm.resource_type = 'search_folder'
         and cm.resource_id = sfi.folder_id
        where sfi.prospect_search_id = new.prospect_search_id
      );
  end if;

  return new;
end;
$$;

drop trigger if exists prospect_thread_messages_mention_notify_tr on public.prospect_thread_messages;
create trigger prospect_thread_messages_mention_notify_tr
  after insert on public.prospect_thread_messages
  for each row execute function public.notify_thread_message_mentions();
