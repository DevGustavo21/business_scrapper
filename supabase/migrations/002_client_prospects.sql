-- Clientes marcados como prospectos (manual o desde una búsqueda).
-- Tras ejecutar, las políticas RLS aplican con el JWT del cliente.

create table if not exists public.client_prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null,
  prospect_search_id uuid references public.prospect_searches (id) on delete cascade,
  search_row_id text,
  nombre text not null default '',
  direccion text not null default '',
  ciudad text not null default '',
  pais text not null default '',
  telefono text not null default '',
  correo text not null default '',
  sitio_web text not null default '',
  problemas_detectados text not null default '',
  oportunidades text not null default '',
  estado text not null default 'Sin contactar',
  constraint client_prospects_source_check check (source in ('manual', 'search')),
  constraint client_prospects_search_row_consistency check (
    (source = 'manual' and prospect_search_id is null and search_row_id is null)
    or (source = 'search' and prospect_search_id is not null and search_row_id is not null)
  )
);

create unique index if not exists client_prospects_user_search_row_uidx
  on public.client_prospects (user_id, prospect_search_id, search_row_id)
  where source = 'search';

create index if not exists client_prospects_user_updated_idx
  on public.client_prospects (user_id, updated_at desc);

create index if not exists client_prospects_user_source_idx
  on public.client_prospects (user_id, source);

alter table public.client_prospects enable row level security;

drop policy if exists client_prospects_select_own on public.client_prospects;
create policy client_prospects_select_own on public.client_prospects
  for select using (auth.uid() = user_id);

drop policy if exists client_prospects_insert_own on public.client_prospects;
create policy client_prospects_insert_own on public.client_prospects
  for insert with check (auth.uid() = user_id);

drop policy if exists client_prospects_update_own on public.client_prospects;
create policy client_prospects_update_own on public.client_prospects
  for update using (auth.uid() = user_id);

drop policy if exists client_prospects_delete_own on public.client_prospects;
create policy client_prospects_delete_own on public.client_prospects
  for delete using (auth.uid() = user_id);
