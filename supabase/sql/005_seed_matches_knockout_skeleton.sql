-- BistekaBet — 32 jogos do mata-mata da Copa 2026 (datas/sedes oficiais)
-- Aplicar manualmente no Supabase Studio APÓS 003 e 004.
-- Os times são preenchidos via UI admin conforme avança a classificação.
--
-- Estrutura (32 partidas):
--   round_of_32   — bracket_position 1..16
--   round_of_16   — bracket_position 1..8
--   quarter       — bracket_position 1..4
--   semi          — bracket_position 1..2
--   third_place   — bracket_position 1
--   final         — bracket_position 1
--
-- NÃO é idempotente. Para reaplicar:
--   delete from public.matches where stage <> 'group';

insert into public.matches (stage, bracket_position, kickoff_at, venue) values
  -- ===== 32-avos (16 jogos: 28/jun a 3/jul) =====
  ('round_of_32',  1, '2026-06-28 23:00+00', 'SoFi Stadium, Los Angeles'),
  ('round_of_32',  2, '2026-06-29 19:00+00', 'NRG Stadium, Houston'),
  ('round_of_32',  3, '2026-06-29 22:30+00', 'Gillette Stadium, Boston'),
  ('round_of_32',  4, '2026-06-29 03:00+00', 'Estadio BBVA, Monterrey'),
  ('round_of_32',  5, '2026-06-30 19:00+00', 'AT&T Stadium, Dallas'),
  ('round_of_32',  6, '2026-06-30 22:00+00', 'MetLife Stadium, Nova Jersey'),
  ('round_of_32',  7, '2026-06-30 03:00+00', 'Estadio Banorte, Cidade do México'),
  ('round_of_32',  8, '2026-07-01 17:00+00', 'Mercedes-Benz Stadium, Atlanta'),
  ('round_of_32',  9, '2026-07-01 00:00+00', 'Lumen Field, Seattle'),
  ('round_of_32', 10, '2026-07-01 04:00+00', 'Levi''s Stadium, San Francisco'),
  ('round_of_32', 11, '2026-07-02 23:00+00', 'SoFi Stadium, Los Angeles'),
  ('round_of_32', 12, '2026-07-02 00:00+00', 'BMO Field, Toronto'),
  ('round_of_32', 13, '2026-07-02 07:00+00', 'BC Place, Vancouver'),
  ('round_of_32', 14, '2026-07-03 21:00+00', 'AT&T Stadium, Dallas'),
  ('round_of_32', 15, '2026-07-03 23:00+00', 'Hard Rock Stadium, Miami'),
  ('round_of_32', 16, '2026-07-03 03:30+00', 'Arrowhead Stadium, Kansas City'),

  -- ===== 16-avos (8 jogos: 4 a 7/jul) =====
  ('round_of_16',  1, '2026-07-04 19:00+00', 'NRG Stadium, Houston'),
  ('round_of_16',  2, '2026-07-04 22:00+00', 'Lincoln Financial Field, Philadelphia'),
  ('round_of_16',  3, '2026-07-05 21:00+00', 'MetLife Stadium, Nova Jersey'),
  ('round_of_16',  4, '2026-07-05 02:00+00', 'Estadio Banorte, Cidade do México'),
  ('round_of_16',  5, '2026-07-06 21:00+00', 'AT&T Stadium, Dallas'),
  ('round_of_16',  6, '2026-07-06 04:00+00', 'Lumen Field, Seattle'),
  ('round_of_16',  7, '2026-07-07 17:00+00', 'Mercedes-Benz Stadium, Atlanta'),
  ('round_of_16',  8, '2026-07-07 00:00+00', 'BC Place, Vancouver'),

  -- ===== Quartas de Final (4 jogos: 9 a 11/jul) =====
  ('quarter',      1, '2026-07-09 21:00+00', 'Gillette Stadium, Boston'),
  ('quarter',      2, '2026-07-10 23:00+00', 'SoFi Stadium, Los Angeles'),
  ('quarter',      3, '2026-07-11 22:00+00', 'Hard Rock Stadium, Miami'),
  ('quarter',      4, '2026-07-11 03:00+00', 'Arrowhead Stadium, Kansas City'),

  -- ===== Semifinais (2 jogos: 14 e 15/jul) =====
  ('semi',         1, '2026-07-14 21:00+00', 'AT&T Stadium, Dallas'),
  ('semi',         2, '2026-07-15 20:00+00', 'Mercedes-Benz Stadium, Atlanta'),

  -- ===== Disputa de 3º lugar (18/jul) =====
  ('third_place',  1, '2026-07-18 22:00+00', 'Hard Rock Stadium, Miami'),

  -- ===== Final (19/jul) =====
  ('final',        1, '2026-07-19 20:00+00', 'MetLife Stadium, Nova Jersey');
