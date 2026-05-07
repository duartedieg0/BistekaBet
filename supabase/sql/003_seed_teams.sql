-- BistekaBet — seed das 48 seleções da Copa 2026
-- Aplicar manualmente no Supabase Studio APÓS 002_init_teams_matches.sql.
-- Idempotente: re-rodar não duplica (on conflict do nothing).
--
-- ==========================================================================
-- ATENÇÃO AO OPERADOR:
-- Este arquivo é um ESQUELETO / TEMPLATE. Antes de executar em produção,
-- substitua as linhas abaixo pelos 48 times reais conforme o sorteio oficial
-- da FIFA (previsto para dez/2025). Verifique:
--   1. code   → código FIFA de 3 letras maiúsculas (ex.: 'BRA', 'GER', 'USA')
--   2. name   → nome em PT-BR
--   3. group_code → letra do grupo (A–L) conforme sorteio; deixe NULL se ainda
--                   não definido e atualize depois via UI admin em /admin/times
-- Os 3 times-sede (CAN, MEX, USA) são pré-classificados e seus grupos podem
-- ser confirmados antes do sorteio geral.
-- ==========================================================================

insert into public.teams (code, name, group_code) values
  ('CAN', 'Canadá',          'A'),
  ('MEX', 'México',          'A'),
  ('USA', 'Estados Unidos',  'A'),
  -- TODO: substituir os placeholders abaixo pelos 45 times restantes
  -- com os dados reais do sorteio oficial da FIFA.
  -- Exemplo de linhas adicionais (remover/substituir conforme sorteio real):
  ('BRA', 'Brasil',      null),
  ('ARG', 'Argentina',   null)
  -- IMPORTANTE: ao executar, substituir esta lista completa pelos 48 times
  -- reais com group_code correto. Se o sorteio ainda não definiu o grupo de
  -- algum time, deixar group_code null e atualizar depois via UI admin.
on conflict (code) do nothing;
