-- BistekaBet — permitir que qualquer usuário autenticado leia palpites
-- de partidas cujo kickoff já ocorreu. Necessário para a página
-- /partidas/[matchId] que mostra todos os palpites de um jogo iniciado.
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

create policy "predictions_select_after_kickoff" on public.predictions
  for select to authenticated using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and m.kickoff_at <= now()
    )
  );
