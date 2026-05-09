-- BistekaBet — preservar kickoff original quando partida é remarcada (SP-05).
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

alter table public.matches
  add column original_kickoff_at timestamptz;

create or replace function public.matches_record_original_kickoff()
returns trigger
language plpgsql as $$
begin
  if new.kickoff_at is distinct from old.kickoff_at
     and old.original_kickoff_at is null then
    new.original_kickoff_at := old.kickoff_at;
  end if;
  return new;
end $$;

create trigger matches_record_original_kickoff
  before update on public.matches
  for each row execute function public.matches_record_original_kickoff();
