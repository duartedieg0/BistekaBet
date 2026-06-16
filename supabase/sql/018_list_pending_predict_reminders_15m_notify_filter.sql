-- BistekaBet — filtro de opt-in WhatsApp na RPC de lembrete 15min
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.
-- Pré-requisito: migration 017 (coluna profiles.notify_whatsapp).
--
-- Acrescenta o predicado `p.notify_whatsapp = true` ao filtro existente para
-- que o workflow n8n só receba como alvos os usuários que aceitaram receber
-- lembretes por WhatsApp. Colunas retornadas e assinatura permanecem
-- idênticas — n8n não precisa de ajuste.

CREATE OR REPLACE FUNCTION public.list_pending_predict_reminders_15m()
 RETURNS TABLE(user_id uuid, display_name text, whatsapp_digits text, match_id uuid, kickoff_at timestamp with time zone, home_code text, home_name text, away_code text, away_name text, minutes_to_kickoff integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select
      p.id,
      p.display_name,
      regexp_replace(p.whatsapp, '\D', '', 'g'),
      m.id,
      m.kickoff_at,
      ht.code,
      ht.name,
      at.code,
      at.name,
      round(extract(epoch from (m.kickoff_at - now())) / 60)::int
    from public.matches m
    join public.teams ht on ht.id = m.home_team_id
    join public.teams at on at.id = m.away_team_id
    cross join public.profiles p
    where m.kickoff_at between now() + interval '14 minutes'
                           and now() + interval '16 minutes'
      and m.status is null
      and p.whatsapp is not null
      and p.notify_whatsapp = true
      and p.paid = true
      and not exists (
        select 1 from public.predictions pr
        where pr.user_id = p.id and pr.match_id = m.id
      )
      and not exists (
        select 1 from public.match_reminder_log l
        where l.match_id = m.id
          and l.user_id  = p.id
          and l.reminder_type = 'predict_15m'
      );
  $function$
