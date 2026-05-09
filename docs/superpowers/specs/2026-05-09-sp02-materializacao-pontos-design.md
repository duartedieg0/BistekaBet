# SP-02 · Materialização de Pontos — Design

**Data:** 2026-05-09
**Plano macro:** [`2026-05-09-plano-macro-regulamento.md`](./2026-05-09-plano-macro-regulamento.md)
**Depende de:** SP-01 (engine TS já implementada).
**Cláusulas cobertas:** §11 (cálculo automático), suporte a §3, §5, §6, §7, §8, §9.

---

## 1. Objetivo

Persistir `{ points, tier }` por palpite numa tabela `prediction_scores`, atualizada
automaticamente quando o admin grava resultado oficial de uma partida. SP-03
(ranking) consome essa tabela com `SUM`/`COUNT` agregados.

## 2. Não-objetivos

- Página de classificação ou desempate — SP-03.
- "Meus palpites" com pontuação visível ao usuário — SP-04.
- Reabertura de palpites em jogos remarcados — SP-05.
- Página de auditoria/histórico de recomputações.
- Notificação a usuários quando seus pontos mudam.
- Recompute parcial por fase ou janela de tempo.

## 3. Decisões de design

| ID | Decisão | Justificativa |
|---|---|---|
| Q1 | Tabela nova `prediction_scores` (1:1 com `predictions`) | Separa input do usuário de output do sistema; permite recálculo sem mexer em palpites. Alternativas (colunas em predictions, view materializada, match_scores) foram rejeitadas. |
| Q2 | Server action síncrona + botão admin "Recalcular tudo" | Caminho 99% via action é simples e observável; botão cobre writes feitos fora da action (Studio, scripts, alterações de regra). Sem Edge Function. |
| Q3 | RLS pública entre autenticados (`select` true) | Pontuação por jogo é "pública" entre participantes; o palpite continua privado via RLS de `predictions`. SP-03 vira query direta sem RPC. |
| Q4 | Resultado ausente / status `cancelled` / `postponed` → DELETE de scores da partida | Score existe ⟺ partida tem resultado válido vigente. Reabertura (SP-05) recalcula do zero após novo resultado. |
| Q5 | Palpite ausente NÃO é materializado como zero | §3 é resolvido na leitura do ranking via `LEFT JOIN ... COALESCE(SUM(points), 0)`. Evita escritas em massa por inscrito. |
| Q6 | Cálculo extraído em `computeScoreRows` puro (sem I/O); função I/O é shell fino | Permite testes unitários determinísticos sem mockar Supabase. |
| Q7 | `tier` como `text` com check constraint | Engine TS é fonte de verdade; mudar enum em Postgres é caro. |

## 4. Arquitetura

### 4.1 Schema (`supabase/sql/008_prediction_scores.sql`)

```sql
create table public.prediction_scores (
  prediction_id uuid primary key references public.predictions(id) on delete cascade,
  match_id      uuid not null references public.matches(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  points        int  not null check (points >= 0),
  tier          text not null check (tier in ('exact','winner_or_draw','miss')),
  scored_at     timestamptz not null default now()
);

create index prediction_scores_user_idx       on public.prediction_scores (user_id);
create index prediction_scores_match_idx      on public.prediction_scores (match_id);
create index prediction_scores_user_tier_idx  on public.prediction_scores (user_id, tier);

alter table public.prediction_scores enable row level security;

create policy "scores_select_authenticated" on public.prediction_scores
  for select to authenticated using (true);

create policy "scores_admin_write" on public.prediction_scores
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
```

`match_id` e `user_id` são desnormalizados (vêm de `predictions.id`) para evitar
joins na agregação do ranking. São imutáveis (não há "trocar dono ou jogo de
um palpite"), portanto seguros.

### 4.2 Módulos novos

```
src/lib/scoring/
  recompute-core.ts   # função pura computeScoreRows(match, predictions) → ScoreRow[] | "delete"
  recompute.ts        # função I/O recomputeMatchScores(matchId): Supabase admin client
  __tests__/
    recompute-core.test.ts
```

### 4.3 Core puro

```ts
// recompute-core.ts
import { score, type Tier } from "@/lib/scoring";
import type { Stage } from "@/lib/types/match";

export type MatchSnapshot = {
  id: string;
  stage: Stage;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
};

export type PredictionSnapshot = {
  id: string;
  user_id: string;
  home_score: number;
  away_score: number;
};

export type ScoreRow = {
  prediction_id: string;
  match_id: string;
  user_id: string;
  points: number;
  tier: Tier;
};

export type ComputeResult =
  | { kind: "delete" }                // resultado ausente / cancelled / postponed
  | { kind: "upsert"; rows: ScoreRow[] };

export function computeScoreRows(
  match: MatchSnapshot,
  predictions: PredictionSnapshot[],
): ComputeResult {
  const noResult =
    match.home_score === null ||
    match.away_score === null ||
    match.status === "cancelled" ||
    match.status === "postponed";

  if (noResult) return { kind: "delete" };

  const rows = predictions.map((p) => {
    const r = score({
      prediction: { home_score: p.home_score, away_score: p.away_score },
      match:      { home_score: match.home_score!, away_score: match.away_score! },
      stage:      match.stage,
    });
    return {
      prediction_id: p.id,
      match_id: match.id,
      user_id: p.user_id,
      points: r.points,
      tier: r.tier,
    };
  });

  return { kind: "upsert", rows };
}
```

### 4.4 Função I/O

```ts
// recompute.ts
import { createAdminClient } from "@/lib/supabase/admin";
import { computeScoreRows } from "./recompute-core";

export async function recomputeMatchScores(matchId: string): Promise<{
  upserted: number;
  deleted: number;
}> {
  const admin = createAdminClient();

  const { data: match, error: mErr } = await admin
    .from("matches")
    .select("id, stage, home_score, away_score, status")
    .eq("id", matchId)
    .single();
  if (mErr) throw mErr;

  const { data: predictions, error: pErr } = await admin
    .from("predictions")
    .select("id, user_id, home_score, away_score")
    .eq("match_id", matchId);
  if (pErr) throw pErr;

  const result = computeScoreRows(match, predictions ?? []);

  if (result.kind === "delete") {
    const { count, error } = await admin
      .from("prediction_scores")
      .delete({ count: "exact" })
      .eq("match_id", matchId);
    if (error) throw error;
    return { upserted: 0, deleted: count ?? 0 };
  }

  if (result.rows.length === 0) return { upserted: 0, deleted: 0 };

  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from("prediction_scores")
    .upsert(
      result.rows.map((r) => ({ ...r, scored_at: now })),
      { onConflict: "prediction_id" },
    );
  if (upErr) throw upErr;

  return { upserted: result.rows.length, deleted: 0 };
}
```

### 4.5 Integração com `updateMatch`

Em `src/app/(authenticated)/admin/partidas/_actions.ts`, **após** o `update` em
`matches` ter sucesso e **antes** de `revalidatePath`:

```ts
await recomputeMatchScores(matchId);
```

Erro propaga: admin vê mensagem; resultado da partida **já está gravado**;
salvar de novo é idempotente.

### 4.6 Action "Recalcular tudo"

Arquivo novo: `src/app/(authenticated)/admin/_actions.ts`.

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeMatchScores } from "@/lib/scoring/recompute";
import { revalidatePath } from "next/cache";

export async function recomputeAllScores(): Promise<{
  matchesProcessed: number;
  upserted: number;
  deleted: number;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");
  const { data: isAdmin } = await supabase.rpc("is_admin", { uid: user.id });
  if (!isAdmin) throw new Error("forbidden");

  const admin = createAdminClient();
  const { data: matches, error } = await admin.from("matches").select("id");
  if (error) throw error;

  let upserted = 0, deleted = 0;
  for (const m of matches ?? []) {
    const r = await recomputeMatchScores(m.id);
    upserted += r.upserted;
    deleted += r.deleted;
  }

  revalidatePath("/admin");
  return { matchesProcessed: matches?.length ?? 0, upserted, deleted };
}
```

### 4.7 UI admin

Página `/admin` (dashboard) ganha um card "Pontuação" com:
- Botão `[Recalcular pontuações]` (Server Action via form).
- Toast de sucesso: "X partidas processadas, Y scores atualizados, Z removidos."
- Erro vira toast vermelho.

## 5. Estratégia de testes

| Arquivo | Cobre |
|---|---|
| `recompute-core.test.ts` | Resultado válido + N palpites → N rows com pontos corretos. Resultado nulo → `kind: 'delete'`. `status='cancelled'` / `postponed` → `kind: 'delete'`. Lista vazia de palpites → `kind: 'upsert', rows: []`. Reuso da engine SP-01 (sem reimplementar lógica). |

`recomputeMatchScores` (função I/O) **não** tem teste automatizado nesta fase —
é shell fino. Verificação E2E manual via admin form (Task de verificação).

## 6. Operação

- **Concorrência:** dois admins salvando a mesma partida ⇒ último upsert vence; sem locks.
- **Observabilidade:** `console.log({ matchId, upserted, deleted, durationMs })` em cada chamada. Sem persistência de log.
- **Performance:** 48 partidas × ~30 inscritos = 1.440 rows pior caso. "Recalcular tudo" em segundos.

## 7. Riscos / questões em aberto

1. **Migração manual** — projeto aplica SQL no Studio. Plano de implementação instrui passo a passo.
2. **Confirmar `createAdminClient`** existe e funciona como em `setUserPaid` (já em uso).
3. **§3 (palpite ausente)** — SP-02 não materializa zeros; SP-03 resolve via `LEFT JOIN`. Premissa documentada aqui e no plano macro.
4. **Coerência de `matches.stage` vs `Stage` TS** — já usada no SP-01; deve estar OK. Plano valida.
5. **`is_admin` RPC** já existe (usado em `setUserPaid`).

## 8. Como SP-03+ consomem

- **SP-03** (ranking + desempate):
  ```sql
  -- pontos totais
  select user_id, coalesce(sum(points), 0) as total
  from public.prediction_scores
  group by user_id;

  -- desempate §12.1: placares exatos
  select user_id, count(*) filter (where tier = 'exact') as exacts
  from public.prediction_scores
  group by user_id;
  ```
  Combina com `LEFT JOIN profiles` para incluir usuários sem nenhum palpite.
- **SP-04** lê `prediction_scores` filtrando `user_id = auth.uid()` (RLS pública permite).
