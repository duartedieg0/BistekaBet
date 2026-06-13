-- supabase/sql/014_app_settings.sql
-- Tabela de configurações globais key/value (admin toggles).

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_read_authenticated" on public.app_settings;
create policy "app_settings_read_authenticated"
  on public.app_settings for select
  to authenticated using (true);

drop policy if exists "app_settings_write_admin" on public.app_settings;
create policy "app_settings_write_admin"
  on public.app_settings for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

insert into public.app_settings (key, value)
values ('event_invite_enabled', 'false'::jsonb)
on conflict (key) do nothing;
