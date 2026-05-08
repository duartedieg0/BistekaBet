-- BistekaBet — controle de pagamento por usuário (admin-only)
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

alter table public.profiles
  add column paid boolean not null default false;

-- A policy "profiles_update_own" permite ao próprio usuário fazer UPDATE
-- na linha. Para impedir auto-marcação, bloqueamos mudanças no campo
-- paid quando current_user não é service_role.
create or replace function public.prevent_paid_change() returns trigger
language plpgsql as $$
begin
  if new.paid is distinct from old.paid
     and current_user not in ('postgres', 'service_role', 'supabase_admin')
  then
    raise exception 'paid can only be changed via service role';
  end if;
  return new;
end $$;

create trigger profiles_prevent_paid_change
  before update on public.profiles
  for each row execute function public.prevent_paid_change();
