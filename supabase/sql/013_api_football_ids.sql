-- BistekaBet — colunas api_football_id em teams/matches + tabela import_runs (auditoria de imports)

alter table public.teams add column if not exists api_football_id bigint unique;
alter table public.matches add column if not exists api_football_id bigint unique;

create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid references auth.users(id),
  source text not null default 'api-football',
  matches_updated int not null default 0,
  matches_unchanged int not null default 0,
  matches_errored int not null default 0,
  diff jsonb not null default '[]'::jsonb
);

create index if not exists import_runs_created_at_desc_idx
  on public.import_runs (created_at desc);

alter table public.import_runs enable row level security;

drop policy if exists "admins read import_runs" on public.import_runs;
create policy "admins read import_runs" on public.import_runs
  for select using (public.is_admin(auth.uid()));

drop policy if exists "admins insert import_runs" on public.import_runs;
create policy "admins insert import_runs" on public.import_runs
  for insert with check (public.is_admin(auth.uid()));
