-- BistekaBet — esqueleto dos 32 jogos do mata-mata (Copa 2026)
-- Aplicar manualmente no Supabase Studio APÓS a fase de grupos ser encerrada.
-- (ou antes, para que o admin possa definir confrontos via UI conforme classificação)
--
-- Copa 2026: 48 times → 32 jogos de mata-mata
--   round_of_32 : 16 jogos  (bracket_position 1–16)
--   round_of_16 :  8 jogos  (bracket_position 1–8)
--   quarter     :  4 jogos  (bracket_position 1–4)
--   semi        :  2 jogos  (bracket_position 1–2)
--   third_place :  1 jogo   (bracket_position 1)
--   final       :  1 jogo   (bracket_position 1)
-- Total: 32 partidas.
--
-- ==========================================================================
-- ATENÇÃO AO OPERADOR:
-- Este arquivo é um ESQUELETO / TEMPLATE. Antes de executar em produção,
-- substitua os kickoff_at e venue pelos dados reais do calendário FIFA.
-- Os campos home_team_id e away_team_id são intencionalmente NULL — serão
-- preenchidos pelo admin via UI em /admin/partidas conforme os times se
-- classificarem. O campo bracket_position identifica a vaga na chave.
-- ==========================================================================

insert into public.matches (stage, bracket_position, kickoff_at, venue) values
  -- round_of_32 (16 jogos) — bracket_position 1–16
  ('round_of_32',  1, '2026-06-27 16:00-03', null),
  ('round_of_32',  2, '2026-06-27 20:00-03', null),
  -- TODO: preencher bracket_positions 3–16 com datas/sedes reais do calendário FIFA
  -- Exemplo de estrutura para os demais:
  -- ('round_of_32',  3, '2026-06-28 16:00-03', null),
  -- ('round_of_32',  4, '2026-06-28 20:00-03', null),
  -- ...
  -- ('round_of_32', 16, '2026-07-03 20:00-03', null),

  -- round_of_16 (8 jogos) — bracket_position 1–8
  -- TODO: preencher com datas/sedes reais
  -- ('round_of_16',  1, '2026-07-04 16:00-03', null),
  -- ...

  -- quarter (4 jogos) — bracket_position 1–4
  -- TODO: preencher com datas/sedes reais
  -- ('quarter',  1, '2026-07-09 16:00-03', null),
  -- ...

  -- semi (2 jogos) — bracket_position 1–2
  -- TODO: preencher com datas/sedes reais
  -- ('semi',  1, '2026-07-14 16:00-03', null),
  -- ('semi',  2, '2026-07-15 16:00-03', null),

  -- third_place (1 jogo)
  -- TODO: preencher com data/sede real
  -- ('third_place', 1, '2026-07-18 16:00-03', null),

  -- final (1 jogo)
  ('final', 1, '2026-07-19 16:00-03', null);
