-- BistekaBet — schema inicial do auth/profiles
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

-- Tabela
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'usuario' check (role in ('usuario','admin')),
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Trigger de criação automática
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper para evitar recursão de RLS
create or replace function public.is_admin(uid uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = uid and role = 'admin');
$$;

-- Trigger que impede mudança de role via UPDATE direto do cliente
create or replace function public.prevent_role_change() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'service_role', 'supabase_admin')
  then
    raise exception 'role can only be changed via service role';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- RLS
alter table public.profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_admin_read_all" on profiles
  for select using (public.is_admin(auth.uid()));
