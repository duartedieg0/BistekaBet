-- BistekaBet — coleta obrigatória de WhatsApp
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

alter table public.profiles
  add column whatsapp text unique
    check (whatsapp ~ '^\+55[1-9][0-9][2-9][0-9]{7}$');
-- formato: +55 DDD XXXXXXXX (12 dígitos após o +)
-- DDD: dois dígitos onde o primeiro != 0
-- número: 8 dígitos onde o primeiro != 0/1

create or replace function public.prevent_whatsapp_change() returns trigger
language plpgsql as $$
begin
  -- só permite NULL -> valor (preenchimento inicial pelo próprio usuário).
  -- alterar valor existente exige service role.
  if old.whatsapp is not null
     and new.whatsapp is distinct from old.whatsapp
     and current_user not in ('postgres','service_role','supabase_admin')
  then
    raise exception 'whatsapp can only be changed via service role';
  end if;
  return new;
end $$;

create trigger profiles_prevent_whatsapp_change
  before update on public.profiles
  for each row execute function public.prevent_whatsapp_change();
