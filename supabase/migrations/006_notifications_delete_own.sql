-- Permitir al usuario borrar sus propias notificaciones (p. ej. tras aceptar/rechazar invitación).

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete using (user_id = (select auth.uid()));
