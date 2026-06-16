-- BistekaBet — log de lembretes enviados (dedupe do worker N8N)
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.
--
-- Pré-requisito da RPC public.list_pending_predict_reminders_15m (017).
-- 1 linha por (match, user, tipo de lembrete). A PK garante que o mesmo
-- lembrete nunca seja enviado duas vezes, mesmo que o cron do N8N reexecute.

create table public.match_reminder_log (
  match_id      uuid not null references public.matches(id) on delete cascade,
  user_id       uuid not null references auth.users(id)    on delete cascade,
  reminder_type text not null,
  sent_at       timestamptz not null default now(),
  primary key (match_id, user_id, reminder_type)
);

create index match_reminder_log_match_idx on public.match_reminder_log (match_id);
create index match_reminder_log_user_idx  on public.match_reminder_log (user_id);

-- RLS: somente service_role (N8N) lê/escreve. Sem policy para anon/authenticated.
alter table public.match_reminder_log enable row level security;
