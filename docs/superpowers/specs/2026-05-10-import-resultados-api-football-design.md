# Design — Import de resultados via API-Football

**Data:** 2026-05-10
**Origem:** `docs/brainstorm/import-resultados-api-football.md`
**Escopo:** Adicionar botão no admin que importa placares finalizados da Copa 2026 via API-Football v3, com preview/diff antes do commit, log de auditoria e recompute automático de pontuação.

## Decisões de design

| # | Decisão |
|---|---|
| 1 | Matching via `api_football_id` (migration nova + seed dos 48 times) |
| 2 | Gatilho: botão manual no admin (cron fica para fase 2, fora deste spec) |
| 3 | Granularidade: 1 chamada que busca todas fixtures da Copa; diff aplica só o que mudou |
| 4 | Sobrescrita: dry-run com modal de diff e confirmação explícita |
| 5 | UX: card no dashboard `/admin` (sem duplicar em `/admin/partidas`) |
| 6 | Sincroniza apenas `home_score`, `away_score`, ET, pênaltis, `winner_team_id` e `status` (mapeado, ver §3.1). `kickoff_at` permanece como cadastrado manualmente |
| 7 | Auditoria: tabela `import_runs` (sem UI de histórico nesta fase) |

**Decisões implícitas:**
- Recompute: após commit, chama `recomputeMatchScores(matchId)` para cada partida cujo placar mudou.
- Partidas mata-mata sem times definidos: API ainda não trará fixture com IDs reais nesses casos; simplesmente não casam via `api_football_id`, são puladas sem erro.
- Rate-limit: botão `disabled` no client enquanto request roda; server-side recusa se última `import_runs` foi há < 30s.

## 1. Schema

Migration nova `013_api_football_ids.sql`:

```sql
alter table public.teams add column api_football_id bigint unique;
alter table public.matches add column api_football_id bigint unique;

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid references auth.users(id),
  source text not null default 'api-football',
  matches_updated int not null default 0,
  matches_unchanged int not null default 0,
  matches_errored int not null default 0,
  diff jsonb not null default '[]'::jsonb
);

alter table public.import_runs enable row level security;
create policy "admins read import_runs" on public.import_runs
  for select using (is_admin(auth.uid()));
create policy "admins insert import_runs" on public.import_runs
  for insert with check (is_admin(auth.uid()));
```

## 2. Estrutura de código

```
src/
  lib/
    api-football/
      client.ts          # fetch wrapper + Zod schemas (FixtureSchema, TeamSchema)
      types.ts           # tipos derivados dos schemas Zod
      mapper.ts          # API fixture -> patch de matches (score, status, winner)
      diff.ts            # compara fixture mapeada com row atual, gera DiffEntry[]
  app/(authenticated)/admin/
    _actions.ts          # server actions: previewImport(), commitImport(entries)
                         # arquivo ja existe; adicionar essas duas actions nele
    _components/
      import-results-card.tsx   # card no dashboard, abre modal
      import-diff-dialog.tsx    # modal: lista DiffEntry[], botão confirmar
scripts/
  seed-api-football-ids.ts      # roda 1x: GET /teams + match por nome -> grava api_football_id
supabase/sql/
  013_api_football_ids.sql
```

**Env vars (server-side, nunca `NEXT_PUBLIC_`):**
- `API_FOOTBALL_KEY` — header `x-apisports-key`
- `API_FOOTBALL_LEAGUE_ID` — id da Copa 2026
- `API_FOOTBALL_SEASON` — `2026`

## 3. Fluxo do import

### 3.1. Mapeamento de `status` (crítico)

A coluna `matches.status` (em `supabase/sql/002_init_teams_matches.sql:56`) tem CHECK constraint que aceita apenas `'postponed'`, `'cancelled'` ou `null`. Os valores brutos da API (`FT/AET/PEN/PST/CANC/...`) **não** podem ser gravados diretamente. O `mapper` aplica:

| API `status.short` | `matches.status` gravado |
|---|---|
| `FT`, `AET`, `PEN` | `null` (placar não-nulo já sinaliza finalização) |
| `PST` (postponed) | `'postponed'` |
| `CANC` (cancelled) | `'cancelled'` |
| `NS`, `TBD`, `LIVE`, `HT`, `1H`, `2H`, qualquer outro | partida pulada (não entra no diff) |

Importante: se uma partida estava `'postponed'` e agora a API retorna `FT`, o import deve gravar `status = null` (limpando o flag) junto com os placares — isso entra no diff como `status: 'postponed' → null`.

O Zod schema em `client.ts` deve usar `z.enum([...])` com a lista completa documentada acima, não `z.string()`, para que mudança de schema da API dispare erro de validação (intenção da decisão 4).

### Fase preview (clique no botão "Importar resultados")

1. Server Action `previewImport()`:
   - `GET https://v3.football.api-sports.io/fixtures?league={LEAGUE_ID}&season={SEASON}` (1 chamada)
   - Valida resposta com Zod; se schema mudou (campo faltando/tipo errado), retorna erro tipado.
   - Carrega `matches` do banco onde `api_football_id is not null`.
   - Para cada fixture finalizada (`status.short` em `FT`/`AET`/`PEN`/`PST`/`CANC`): casa via `api_football_id`, roda `mapper` → roda `diff`.
   - Retorna `DiffEntry[]` ao cliente. **Não grava nada.**

```ts
type DiffEntry = {
  matchId: string;
  apiFootballId: number;
  label: string;             // "Brasil x Argentina"
  changes: Array<{
    field: 'home_score' | 'away_score' | 'home_score_et' | 'away_score_et'
         | 'home_pens' | 'away_pens' | 'winner_team_id' | 'status';
    from: unknown;
    to: unknown;
  }>;
  willRecompute: boolean;    // true se algum campo de placar mudou
};
```

2. Modal `import-diff-dialog.tsx` mostra a lista. Se `entries.length === 0`, exibe "Nada a importar". Botão **Confirmar** envia `DiffEntry[]` de volta.

### Fase commit

3. Server Action `commitImport(entries)`:
   - Verifica admin (RLS + checagem explícita).
   - Verifica rate-limit (apenas no commit, não no preview): se última `import_runs` foi há < 30s, retorna erro.
   - Em transação:
     - Para cada entry, aplica `update matches set ... where id = entry.matchId` (apenas campos com `from !== to`).
     - Insere row em `import_runs` com contagens + payload `diff` em jsonb.
   - Após transação, para cada match com `willRecompute === true`: `await recomputeMatchScores(matchId)`.
   - Retorna `{ updated, unchanged, errored }` para o cliente. UI mostra toast.

## 4. Edge cases & error handling

| Caso | Comportamento |
|---|---|
| Fixture com `teams.home.id` ausente em `teams.api_football_id` | Pula, conta em `errored`, registra em `diff` com `reason: 'team_not_mapped'` |
| Match com placeholder mata-mata (sem `api_football_id`) | Não casa; não aparece no diff; sem erro |
| Status `PST` / `CANC` | Mapeia para `'postponed'` / `'cancelled'` (ver §3.1); placares ficam `null` |
| Match estava `postponed` mas agora API retorna `FT`/`AET`/`PEN` | Grava `status = null` + placares (entra no diff como `status: 'postponed' → null`) |
| Status `NS` / `TBD` (não começou) | Pula |
| Status `LIVE` / `HT` / `1H` / `2H` | Pula (MVP só importa finalizadas) |
| API 5xx / timeout | Server Action retorna erro tipado; toast "API indisponível" |
| Zod schema falha | Erro detalhado no log; admin usa fluxo manual existente |
| Duplo-clique | Botão `disabled` no client; rate-limit < 30s no server |
| `winner_team_id` em mata-mata | Derivado pelo `mapper`: agregado de placar; em PEN, vence quem tem mais pênaltis |

## 5. Seed dos `api_football_id`

Script único `scripts/seed-api-football-ids.ts`, idempotente:

1. `GET /teams?league={LEAGUE_ID}&season={SEASON}` → 48 times.
2. Para cada time da API: casa com `teams` do banco por `name` normalizado (trim + lowercase + sem acento). Falha → loga e exige resolução manual (não escreve nada se ambíguo).
3. `update teams set api_football_id = ? where id = ?`.
4. `GET /fixtures?league={LEAGUE_ID}&season={SEASON}` → 104 partidas.
5. Para cada fixture com ambos os times já mapeados: casa com `matches` por `(home_team_id, away_team_id, date(kickoff_at))` e grava `matches.api_football_id`. Mata-mata sem times resolvidos fica `null`; script pode ser re-rodado quando a API publicar os times.

Execução: `pnpm tsx scripts/seed-api-football-ids.ts`.

## 6. Testes

- **Unit (`mapper.ts`)**: para cada status (FT/AET/PEN/PST/CANC), valida mapping correto de scores, ET, pens, winner, status.
- **Unit (`diff.ts`)**: dado match no banco e fixture mapeada, retorna diff esperado nos cenários: sem mudanças, mudança parcial (só placar), todas mudanças, status mudou para PST.
- **Integration (`previewImport`)**: client API mockado, popula `matches` em DB de teste, valida `DiffEntry[]` retornado e que **nenhum** dado foi escrito.
- **Integration (`commitImport`)**: aplica diff, valida `matches` atualizadas, row inserida em `import_runs`, `recomputeMatchScores` chamado apenas para matches com placar alterado.

## 7. Critérios de sucesso

- Admin clica 1 botão no dashboard → modal de diff → confirma → placares e status atualizados + pontuações recalculadas + run logada.
- Tempo do admin durante a Copa: de ~5min/jogo para ~10s/dia.
- Zero erro de digitação de placar.
- Schema preparado para fase 2 (cron) sem nova migration.

## 8. Fora de escopo

- Cron / sync automática (fase 2).
- UI de histórico de imports (consultar via Supabase basta nesta fase).
- Importar partidas em andamento (live).
- Atualizar `kickoff_at` automaticamente.
