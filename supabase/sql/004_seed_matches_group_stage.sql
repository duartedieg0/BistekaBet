-- BistekaBet — seed dos 72 jogos da fase de grupos da Copa 2026
-- Dados oficiais (calendário FIFA divulgado em maio/2026).
-- Aplicar manualmente no Supabase Studio APÓS 003_seed_teams.sql.
--
-- NÃO é idempotente. Para reaplicar, executar antes:
--   delete from public.matches where stage = 'group';
--
-- Horários armazenados em UTC (timestamptz). A UI converte para o timezone do
-- usuário em runtime via toLocaleString. Todas as datas/horários são fontes
-- abertas (Al Jazeera Sports, maio/2026); o admin pode ajustar individualmente
-- se houver mudanças oficiais.

with t as (
  select code, id from public.teams
)
insert into public.matches (
  stage, group_code, home_team_id, away_team_id, kickoff_at, venue
)
select 'group', g, h.id, a.id, k::timestamptz, v from (values
  -- ===== Rodada 1 =====
  -- 11/jun (estreia)
  ('A', 'MEX', 'RSA', '2026-06-11 21:00+00', 'Estadio Banorte, Cidade do México'),
  ('A', 'KOR', 'CZE', '2026-06-12 04:00+00', 'Estadio Akron, Guadalajara'),
  -- 12/jun
  ('B', 'CAN', 'BIH', '2026-06-12 20:00+00', 'BMO Field, Toronto'),
  ('D', 'USA', 'PAR', '2026-06-13 05:00+00', 'SoFi Stadium, Los Angeles'),
  -- 13/jun
  ('B', 'QAT', 'SUI', '2026-06-13 23:00+00', 'Levi''s Stadium, San Francisco'),
  ('C', 'BRA', 'MAR', '2026-06-13 23:00+00', 'MetLife Stadium, Nova Jersey'),
  ('C', 'HAI', 'SCO', '2026-06-14 02:00+00', 'Gillette Stadium, Boston'),
  ('D', 'AUS', 'TUR', '2026-06-14 08:00+00', 'BC Place, Vancouver'),
  -- 14/jun
  ('E', 'GER', 'CUW', '2026-06-14 19:00+00', 'NRG Stadium, Houston'),
  ('F', 'NED', 'JPN', '2026-06-14 22:00+00', 'AT&T Stadium, Dallas'),
  ('E', 'CIV', 'ECU', '2026-06-15 00:00+00', 'Lincoln Financial Field, Philadelphia'),
  ('F', 'SWE', 'TUN', '2026-06-15 04:00+00', 'Estadio BBVA, Monterrey'),
  -- 15/jun
  ('H', 'ESP', 'CPV', '2026-06-15 17:00+00', 'Mercedes-Benz Stadium, Atlanta'),
  ('G', 'BEL', 'EGY', '2026-06-15 23:00+00', 'BC Place, Vancouver'),
  ('H', 'KSA', 'URU', '2026-06-15 23:00+00', 'Hard Rock Stadium, Miami'),
  ('G', 'IRN', 'NZL', '2026-06-16 05:00+00', 'SoFi Stadium, Los Angeles'),
  -- 16/jun
  ('I', 'FRA', 'SEN', '2026-06-16 20:00+00', 'MetLife Stadium, Nova Jersey'),
  ('I', 'IRQ', 'NOR', '2026-06-16 23:00+00', 'Gillette Stadium, Boston'),
  ('J', 'ARG', 'ALG', '2026-06-17 03:00+00', 'Arrowhead Stadium, Kansas City'),
  ('J', 'AUT', 'JOR', '2026-06-17 08:00+00', 'Levi''s Stadium, San Francisco'),
  -- 17/jun
  ('K', 'POR', 'COD', '2026-06-17 19:00+00', 'NRG Stadium, Houston'),
  ('L', 'ENG', 'CRO', '2026-06-17 22:00+00', 'AT&T Stadium, Dallas'),
  ('L', 'GHA', 'PAN', '2026-06-18 00:00+00', 'BMO Field, Toronto'),
  ('K', 'UZB', 'COL', '2026-06-18 04:00+00', 'Estadio Banorte, Cidade do México'),

  -- ===== Rodada 2 =====
  -- 18/jun
  ('A', 'CZE', 'RSA', '2026-06-18 17:00+00', 'Mercedes-Benz Stadium, Atlanta'),
  ('B', 'SUI', 'BIH', '2026-06-18 23:00+00', 'SoFi Stadium, Los Angeles'),
  ('B', 'CAN', 'QAT', '2026-06-19 02:00+00', 'BC Place, Vancouver'),
  ('A', 'MEX', 'KOR', '2026-06-19 03:00+00', 'Estadio Akron, Guadalajara'),
  -- 19/jun
  ('C', 'SCO', 'MAR', '2026-06-19 23:00+00', 'Gillette Stadium, Boston'),
  ('D', 'USA', 'AUS', '2026-06-19 23:00+00', 'Lumen Field, Seattle'),
  ('C', 'BRA', 'HAI', '2026-06-20 02:00+00', 'Lincoln Financial Field, Philadelphia'),
  ('D', 'TUR', 'PAR', '2026-06-20 08:00+00', 'Levi''s Stadium, San Francisco'),
  -- 20/jun
  ('F', 'NED', 'SWE', '2026-06-20 19:00+00', 'NRG Stadium, Houston'),
  ('E', 'GER', 'CIV', '2026-06-20 21:00+00', 'BMO Field, Toronto'),
  ('E', 'ECU', 'CUW', '2026-06-21 04:00+00', 'Arrowhead Stadium, Kansas City'),
  ('F', 'TUN', 'JPN', '2026-06-21 06:00+00', 'Estadio BBVA, Monterrey'),
  -- 21/jun
  ('H', 'ESP', 'KSA', '2026-06-21 17:00+00', 'Mercedes-Benz Stadium, Atlanta'),
  ('G', 'BEL', 'IRN', '2026-06-21 23:00+00', 'SoFi Stadium, Los Angeles'),
  ('H', 'URU', 'CPV', '2026-06-21 23:00+00', 'Hard Rock Stadium, Miami'),
  ('G', 'NZL', 'EGY', '2026-06-22 05:00+00', 'BC Place, Vancouver'),
  -- 22/jun
  ('J', 'ARG', 'AUT', '2026-06-22 19:00+00', 'AT&T Stadium, Dallas'),
  ('I', 'FRA', 'IRQ', '2026-06-22 22:00+00', 'Lincoln Financial Field, Philadelphia'),
  ('I', 'NOR', 'SEN', '2026-06-23 01:00+00', 'MetLife Stadium, Nova Jersey'),
  ('J', 'JOR', 'ALG', '2026-06-23 07:00+00', 'Levi''s Stadium, San Francisco'),
  -- 23/jun
  ('K', 'POR', 'UZB', '2026-06-23 19:00+00', 'NRG Stadium, Houston'),
  ('L', 'ENG', 'GHA', '2026-06-23 21:00+00', 'Gillette Stadium, Boston'),
  ('L', 'PAN', 'CRO', '2026-06-24 00:00+00', 'BMO Field, Toronto'),
  ('K', 'COL', 'COD', '2026-06-24 04:00+00', 'Estadio Akron, Guadalajara'),

  -- ===== Rodada 3 (jogos simultâneos por grupo) =====
  -- 24/jun — Grupos B e C
  ('B', 'SUI', 'CAN', '2026-06-24 23:00+00', 'BC Place, Vancouver'),
  ('B', 'BIH', 'QAT', '2026-06-24 23:00+00', 'Lumen Field, Seattle'),
  ('C', 'SCO', 'BRA', '2026-06-24 23:00+00', 'Hard Rock Stadium, Miami'),
  ('C', 'MAR', 'HAI', '2026-06-24 23:00+00', 'Mercedes-Benz Stadium, Atlanta'),
  -- 24/jun (madrugada de 25) — Grupo A
  ('A', 'CZE', 'MEX', '2026-06-25 03:00+00', 'Estadio Banorte, Cidade do México'),
  ('A', 'RSA', 'KOR', '2026-06-25 03:00+00', 'Estadio BBVA, Monterrey'),
  -- 25/jun — Grupos E e F
  ('E', 'ECU', 'GER', '2026-06-25 21:00+00', 'MetLife Stadium, Nova Jersey'),
  ('E', 'CUW', 'CIV', '2026-06-25 21:00+00', 'Lincoln Financial Field, Philadelphia'),
  ('F', 'JPN', 'SWE', '2026-06-26 01:00+00', 'AT&T Stadium, Dallas'),
  ('F', 'TUN', 'NED', '2026-06-26 01:00+00', 'Arrowhead Stadium, Kansas City'),
  -- 26/jun (madrugada) — Grupo D
  ('D', 'TUR', 'USA', '2026-06-26 06:00+00', 'SoFi Stadium, Los Angeles'),
  ('D', 'PAR', 'AUS', '2026-06-26 06:00+00', 'Levi''s Stadium, San Francisco'),
  -- 26/jun — Grupos H e I
  ('I', 'NOR', 'FRA', '2026-06-26 20:00+00', 'Gillette Stadium, Boston'),
  ('I', 'SEN', 'IRQ', '2026-06-26 20:00+00', 'BMO Field, Toronto'),
  ('H', 'CPV', 'KSA', '2026-06-27 02:00+00', 'NRG Stadium, Houston'),
  ('H', 'URU', 'ESP', '2026-06-27 02:00+00', 'Estadio Akron, Guadalajara'),
  -- 27/jun (madrugada) — Grupo G
  ('G', 'EGY', 'IRN', '2026-06-27 07:00+00', 'Lumen Field, Seattle'),
  ('G', 'NZL', 'BEL', '2026-06-27 07:00+00', 'BC Place, Vancouver'),
  -- 27/jun — Grupos K e L
  ('L', 'PAN', 'ENG', '2026-06-27 22:00+00', 'MetLife Stadium, Nova Jersey'),
  ('L', 'CRO', 'GHA', '2026-06-27 22:00+00', 'Lincoln Financial Field, Philadelphia'),
  ('K', 'COL', 'POR', '2026-06-28 02:30+00', 'Hard Rock Stadium, Miami'),
  ('K', 'COD', 'UZB', '2026-06-28 02:30+00', 'Mercedes-Benz Stadium, Atlanta'),
  -- 28/jun (madrugada) — Grupo J (encerra a fase de grupos)
  ('J', 'ALG', 'AUT', '2026-06-28 04:00+00', 'Arrowhead Stadium, Kansas City'),
  ('J', 'JOR', 'ARG', '2026-06-28 04:00+00', 'AT&T Stadium, Dallas')
) as fx(g, home_code, away_code, k, v)
join t h on h.code = fx.home_code
join t a on a.code = fx.away_code;
