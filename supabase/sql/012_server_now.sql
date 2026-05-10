-- BistekaBet — função server_now() para alinhar a server action ao relógio do Postgres.
-- Usada em validateAgainstMatches (palpites/_actions.ts) para validar bloqueio de palpite
-- com a mesma fonte de tempo da RLS de predictions.
-- Aplicar manualmente no Supabase Studio.

create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$ select now(); $$;

-- Permitir chamada via PostgREST (clientes anon e authenticated).
grant execute on function public.server_now() to anon, authenticated;
