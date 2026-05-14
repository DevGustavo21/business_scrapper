-- Ejecutar en Supabase: SQL Editor → New query → pegar y Run.
-- Historial de búsquedas por usuario (RLS). Tras crear la tabla, las políticas aplican con el JWT del cliente.

create table if not exists public.prospect_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  categoria text not null,
  ubicacion text not null,
  cantidad_solicitada int not null,
  status text not null default 'running',
  finish_reason text,
  result_count int not null default 0,
  negocios jsonb not null default '[]'::jsonb,
  constraint prospect_searches_status_check check (status in ('running', 'completed', 'error')),
  constraint prospect_searches_finish_check check (
    finish_reason is null or finish_reason in ('target_met', 'timeout')
  )
);

create index if not exists prospect_searches_user_updated_idx
  on public.prospect_searches (user_id, updated_at desc);

alter table public.prospect_searches enable row level security;

drop policy if exists prospect_searches_select_own on public.prospect_searches;
create policy prospect_searches_select_own on public.prospect_searches
  for select using (auth.uid() = user_id);

drop policy if exists prospect_searches_insert_own on public.prospect_searches;
create policy prospect_searches_insert_own on public.prospect_searches
  for insert with check (auth.uid() = user_id);

drop policy if exists prospect_searches_update_own on public.prospect_searches;
create policy prospect_searches_update_own on public.prospect_searches
  for update using (auth.uid() = user_id);

drop policy if exists prospect_searches_delete_own on public.prospect_searches;
create policy prospect_searches_delete_own on public.prospect_searches
  for delete using (auth.uid() = user_id);
