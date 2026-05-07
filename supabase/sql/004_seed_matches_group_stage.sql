-- BistekaBet — seed dos 72 jogos da fase de grupos
-- Aplicar manualmente no Supabase Studio APÓS 003_seed_teams.sql.
-- NÃO é idempotente — só rodar uma vez.
-- Se precisar reaplicar, truncar primeiro:
--   delete from public.matches where stage = 'group';
--
-- ==========================================================================
-- ATENÇÃO AO OPERADOR:
-- Este arquivo é um ESQUELETO / TEMPLATE. Antes de executar em produção,
-- substitua as linhas de valores (values) pelo calendário oficial da FIFA
-- (divulgado junto com o sorteio). Verifique:
--   1. 12 grupos × 6 jogos cada = 72 partidas no total.
--   2. Cada seleção joga exatamente 3 partidas na fase de grupos.
--   3. Os códigos home_code / away_code devem existir em public.teams.
--   4. kickoff_at deve incluir o offset de timezone correto
--      (ex.: '2026-06-11 20:00-03' para horário de Brasília −3).
--   5. venue é opcional (pode ser null ou string livre).
-- ==========================================================================

with t as (
  select code, id from public.teams
)
insert into public.matches (
  stage, group_code, home_team_id, away_team_id, kickoff_at, venue
)
select 'group', g, h.id, a.id, k::timestamptz, v from (values
  -- -----------------------------------------------------------------------
  -- TODO: substituir os placeholders abaixo pelo calendário FIFA real.
  -- Formato de cada linha:
  --   ('GRUPO', 'HOME_CODE', 'AWAY_CODE', 'YYYY-MM-DD HH:MM+TZ', 'Venue')
  -- -----------------------------------------------------------------------

  -- Grupo A — 6 jogos (MEX vs XXX, CAN vs YYY, USA vs ZZZ, ...)
  ('A', 'MEX', 'USA', '2026-06-11 20:00-03', 'Estádio Azteca, Cidade do México'),
  ('A', 'CAN', 'MEX', '2026-06-12 16:00-03', 'BMO Field, Toronto'),
  -- TODO: preencher os 70 jogos restantes (grupos B–L e jogos faltantes do A)
  ('L', 'BRA', 'ARG', '2026-06-26 22:00-03', null)
  -- IMPORTANTE: as linhas acima são PLACEHOLDERS de exemplo.
  -- Substituir pela lista real de 72 jogos antes de executar.
) as fx(g, home_code, away_code, k, v)
join t h on h.code = fx.home_code
join t a on a.code = fx.away_code;
