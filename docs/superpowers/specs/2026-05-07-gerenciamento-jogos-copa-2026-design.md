# Gerenciamento de Jogos da Copa 2026 — Design

**Data:** 2026-05-07
**Escopo:** Persistência e gerenciamento administrativo dos jogos da Copa do Mundo FIFA 2026.
**Status:** Aprovado para planejamento de implementação.

## Contexto

BistekaBet é um webapp de bolão da Copa 2026 em Next.js + Supabase + Vercel. Já existe autenticação via Supabase, tabela `public.profiles` com role `usuario`/`admin`, função `public.is_admin(uid)` e área `/admin` esqueleto. Esta é a primeira feature funcional do admin: cadastrar e gerenciar os jogos.

A Copa 2026 tem 48 seleções, 12 grupos (A–L) de 4 times, e fase eliminatória com 32-avos, 16-avos, quartas, semifinais, disputa de 3º e final — totalizando 104 jogos.

## Objetivo

Persistir o fixture da Copa e expor uma UI admin enxuta para registrar resultados (incluindo prorrogação e pênaltis) e definir confrontos do mata-mata conforme avançam. As tabelas devem servir de base para a feature de palpites/ranking que vem depois — sem incluí-la neste escopo.

## Não-objetivos

- Palpites, pontuação ou ranking de usuários.
- Visualização pública dos jogos pelo usuário comum (entra na próxima feature).
- Importação automática de fixtures/resultados via API externa.
- Suporte a múltiplos torneios — esta aplicação é exclusiva da Copa 2026.

## Arquitetura

Três peças:

1. **Schema Postgres** (Supabase): tabelas `teams` e `matches`, com RLS, triggers e índices.
2. **Seeds SQL**: cadastro inicial das 48 seleções e dos 72 jogos da fase de grupos.
3. **UI admin** em `/admin/jogos` e `/admin/times` (Server Actions + RLS).

O banco é a fonte da verdade. O app valida via Zod para UX, mas as constraints SQL garantem consistência.

## Schema

### `public.teams`

| Coluna       | Tipo          | Notas                                    |
| ------------ | ------------- | ---------------------------------------- |
| `id`         | `uuid` PK     | `default gen_random_uuid()`              |
| `code`       | `text` UNIQUE | Código FIFA (ex.: `'BRA'`, `'ARG'`)      |
| `name`       | `text`        | Nome PT-BR (ex.: `'Brasil'`)             |
| `flag_url`   | `text` NULL   | URL do escudo/bandeira                   |
| `group_code` | `text` NULL   | `'A'..'L'` — facilita classificação      |
| `created_at` | `timestamptz` | `default now()`                          |
| `updated_at` | `timestamptz` | `default now()`, atualizado via trigger  |

### `public.matches`

| Coluna             | Tipo          | Notas                                                                                  |
| ------------------ | ------------- | -------------------------------------------------------------------------------------- |
| `id`               | `uuid` PK     | `default gen_random_uuid()`                                                            |
| `stage`            | `text`        | `check in ('group','round_of_32','round_of_16','quarter','semi','third_place','final')` |
| `group_code`       | `text` NULL   | Obrigatório quando `stage='group'`, NULL caso contrário                                |
| `bracket_position` | `int` NULL    | Obrigatório no mata-mata (ex.: "Semifinal 1" = `1`); NULL na fase de grupos            |
| `home_team_id`     | `uuid` NULL   | FK `teams(id)`. NULL no mata-mata até o confronto ser definido                         |
| `away_team_id`     | `uuid` NULL   | FK `teams(id)`. NULL no mata-mata até o confronto ser definido                         |
| `kickoff_at`       | `timestamptz` | Horário de início (timezone-aware)                                                     |
| `venue`            | `text` NULL   | Estádio/cidade                                                                         |
| `status`           | `text` NULL   | `check in ('postponed','cancelled')`. NULL = derivar de `kickoff_at` + placar          |
| `home_score`       | `int` NULL    | Placar 90 min                                                                          |
| `away_score`       | `int` NULL    | Placar 90 min                                                                          |
| `home_score_et`    | `int` NULL    | Placar acumulado após prorrogação                                                      |
| `away_score_et`    | `int` NULL    | Placar acumulado após prorrogação                                                      |
| `home_pens`        | `int` NULL    | Pênaltis convertidos                                                                   |
| `away_pens`        | `int` NULL    | Pênaltis convertidos                                                                   |
| `winner_team_id`   | `uuid` NULL   | FK `teams(id)`. Preenchido apenas no mata-mata após encerrar                           |
| `created_at`       | `timestamptz` | `default now()`                                                                        |
| `updated_at`       | `timestamptz` | `default now()`, atualizado via trigger                                                |

### Constraints adicionais em `matches`

- `(stage = 'group') = (group_code is not null)` — grupo obrigatório só na fase de grupos.
- `stage = 'group' or bracket_position is not null` — mata-mata sempre tem posição.
- `home_team_id is null or away_team_id is null or home_team_id <> away_team_id` — time não joga contra ele mesmo.
- Scores são todos `>= 0` quando preenchidos.

### Índices em `matches`

- `(stage, group_code, kickoff_at)` — listar jogos do Grupo A em ordem.
- `(stage, bracket_position)` — localizar "Semifinal 1" diretamente.
- `(kickoff_at)` — agenda geral / próximos jogos.
- `(home_team_id)`, `(away_team_id)` — jogos de uma seleção.

### Trigger `set_updated_at`

Função genérica `public.set_updated_at()` aplicada via trigger `before update` em `teams` e `matches`.

### RLS

Ambas as tabelas com RLS habilitada.

- `teams_select_authenticated`: `for select to authenticated using (true)`
- `teams_admin_write`: `for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))`
- `matches_select_authenticated`: idem `select`
- `matches_admin_write`: idem `all`

## Seeds

- `003_seed_teams.sql` — insert das 48 seleções com `code`, `name`, `flag_url`, `group_code` conforme sorteio oficial. Idempotente (`on conflict (code) do nothing`).
- `004_seed_matches_group_stage.sql` — insert dos 72 jogos da fase de grupos (`stage='group'`, `group_code`, `home_team_id`, `away_team_id`, `kickoff_at`, `venue`). Mata-mata fica vazio e é preenchido conforme classificação.

## UI Admin

### Rotas

- `src/app/(authenticated)/admin/jogos/page.tsx` — lista de jogos com tabs por fase (Grupos A–L, 32-avos, 16-avos, Quartas, Semis, 3º, Final). Cada linha: data/hora, mandante × visitante, placar (se houver), status. Ações: "Editar resultado" e "Definir confronto" (quando mata-mata vazio).
- `src/app/(authenticated)/admin/jogos/[id]/page.tsx` — formulário de edição de um jogo: kickoff, venue, mandante/visitante (selects de `teams`), placar 90 min, prorrogação, pênaltis, vencedor, status (`postponed`/`cancelled`/limpo).
- `src/app/(authenticated)/admin/times/page.tsx` — CRUD básico de seleções: `code`, `name`, `flag_url`, `group_code`.

### Server Actions

`src/app/(authenticated)/admin/jogos/_actions.ts`:

- `updateMatch(id, payload)` — valida com Zod, persiste via supabase server client. RLS garante que só admin escreve.
- `setMatchTeams(id, homeId, awayId)` — define confronto do mata-mata.

`src/app/(authenticated)/admin/times/_actions.ts`:

- `upsertTeam(payload)` — criar/editar seleção.

### Componentes

`src/app/(authenticated)/admin/jogos/_components/`:
- `match-list.tsx` — lista agrupada.
- `match-form.tsx` — formulário de edição (placar/prorrogação/pênaltis com toggles condicionais).
- `stage-tabs.tsx` — navegação entre fases.

### Sidebar

Adicionar links "Jogos" e "Times" em `src/app/(authenticated)/admin/_components/admin-shell.tsx`.

## Validação

Zod schemas em `src/lib/validation/match.ts` espelhando os checks SQL:

- `stage` enum.
- Scores não-negativos.
- Se `home_score_et` ou `away_score_et` preenchido, ambos os 90 min devem estar preenchidos também.
- Se `home_pens` ou `away_pens` preenchidos, ET de ambos preenchidos.
- No mata-mata com placar fechado (não empate), `winner_team_id` derivado; em empate com pênaltis, vencedor = quem tem mais pênaltis.

Types compartilhados em `src/lib/types/match.ts` (`Stage`, `MatchStatus`, `Match`, `Team`).

## Lifecycle do jogo (derivação de status)

Status derivado em runtime quando `matches.status is null`:

- `kickoff_at > now()` → `scheduled`
- `kickoff_at <= now()` e `home_score is null` → `live`
- `home_score is not null` → `finished`

`status` explícito (`postponed`/`cancelled`) sobrepõe a derivação.

## Critérios de pronto

- SQL aplicado no Supabase Studio; RLS ativa nas duas tabelas.
- Admin lê e escreve `teams` e `matches`; usuário comum só lê.
- Seeds carregados: 48 seleções + 72 jogos da fase de grupos.
- Admin consegue, via UI:
  - Listar jogos por fase.
  - Editar kickoff, venue, placar, prorrogação, pênaltis e status de um jogo.
  - Definir confronto pendente do mata-mata.
  - Gerenciar seleções (criar/editar).
- Tipos TS sincronizados com schema.

## Plano de migração

Aplicação manual no Supabase Studio, na ordem:

1. `002_init_teams_matches.sql` — DDL + RLS + triggers + índices.
2. `003_seed_teams.sql` — 48 seleções.
3. `004_seed_matches_group_stage.sql` — 72 jogos da fase de grupos.

Sem rollback automatizado — em caso de erro, recriar a partir de scripts versionados.

## Riscos e mitigações

- **Sorteio oficial pode mudar grupos/datas antes da feature ir pra produção.** Os seeds são SQL versionado e idempotentes para `teams`; para `matches`, basta um script de correção pontual ou `truncate` + reseed enquanto a fase de grupos não tem palpites associados.
- **Confrontos do mata-mata só existem após a fase de grupos.** Schema permite `home_team_id`/`away_team_id` NULL e a UI tem fluxo dedicado pra preencher.
- **Prorrogação/pênaltis adicionam complexidade no formulário.** Mitigado por toggles condicionais e validação Zod (não exibe pênaltis se ET não está preenchido).
