-- Eliminar la notificación de invitación cuando el invite deja de estar pendiente
-- (aceptar / rechazar / revocación), para que no reaparezca al recargar.

-- Filas antiguas creadas antes de este arreglo
delete from public.notifications n
using public.collaboration_invites i
where n.type = 'collab_invite'
  and (n.data->>'invite_id')::uuid = i.id
  and i.status is distinct from 'pending';

create or replace function public.collaboration_invites_cleanup_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending' and new.status is distinct from 'pending' then
    delete from public.notifications
    where type = 'collab_invite'
      and (data->>'invite_id')::uuid = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists collaboration_invites_cleanup_notify_tr on public.collaboration_invites;
create trigger collaboration_invites_cleanup_notify_tr
  after update of status on public.collaboration_invites
  for each row
  execute function public.collaboration_invites_cleanup_notifications();
