# SP-02 Materialização de Pontos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistir `{ points, tier }` por palpite numa nova tabela `prediction_scores`, recalculada automaticamente quando o admin grava resultado de partida e via botão "Recalcular tudo" no dashboard.

**Architecture:** Tabela 1:1 com `predictions`, escrita exclusivamente via `service_role` (admin client) — leitura pública entre autenticados. Cálculo extraído em função pura `computeScoreRows` (testável) e função I/O `recomputeMatchScores` (shell). Hook em `updateMatch` chama o recompute. Action `recomputeAllScores` itera todas as partidas.

**Tech Stack:** Next.js 16 App Router · Server Actions · Supabase (RLS + admin client) · vitest · TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-09-sp02-materializacao-pontos-design.md`
**Plano macro:** `docs/superpowers/specs/2026-05-09-plano-macro-regulamento.md`
**Depende de:** SP-01 (engine TS já implementada).

**Notas para o executor:**
- Package manager: **npm**.
- Migrações SQL aplicadas **manualmente** no Supabase Studio (SQL Editor) com service role. Os arquivos em `supabase/sql/` são histórico/referência.
- Helper admin client: `createAdminClient()` em `src/lib/supabase/admin.ts` (já em uso por `setUserPaid`).
- `<Toaster />` da `sonner` já está montado em `src/app/(authenticated)/layout.tsx`.
- RPC `is_admin(uid)` já existe (usado em `setUserPaid`).
- Engine SP-01: `import { score } from "@/lib/scoring"` — já testada.
- Não criar Edge Function nem trigger Postgres; cálculo é em TS.

---

## File Structure

**Criar:**
- `supabase/sql/008_prediction_scores.sql` — migração: tabela + índices + RLS.
- `src/lib/scoring/recompute-core.ts` — função pura `computeScoreRows`.
- `src/lib/scoring/recompute.ts` — função I/O `recomputeMatchScores`.
- `src/lib/scoring/__tests__/recompute-core.test.ts` — testes da função pura.
- `src/app/(authenticated)/admin/_actions.ts` — action `recomputeAllScores`.
- `src/app/(authenticated)/admin/_components/recompute-scores-card.tsx` — card client com botão.

**Modificar:**
- `src/app/(authenticated)/admin/partidas/_actions.ts` — chamar `recomputeMatchScores(matchId)` após o `update`.
- `src/app/(authenticated)/admin/page.tsx` — incluir `<RecomputeScoresCard />` no dashboard.

---

## Task 1: Migração SQL `prediction_scores`

**Files:**
- Create: `supabase/sql/008_prediction_scores.sql`

- [ ] **Step 1: Criar arquivo de migração**

Conteúdo de `supabase/sql/008_prediction_scores.sql`:

```sql
-- BistekaBet — materialização de pontos por palpite (SP-02)
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

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

- [ ] **Step 2: Aplicar no Supabase Studio**

Abrir o projeto no Supabase Studio → SQL Editor → colar o conteúdo do arquivo → Run.

Verificar no Table Editor que `prediction_scores` existe com as 6 colunas, 3 índices e RLS habilitado.

- [ ] **Step 3: Smoke test no SQL Editor (service_role)**

```sql
-- Deve estar vazia
select count(*) from public.prediction_scores;

-- Verifica check constraint de tier
do $$ begin
  begin
    insert into public.prediction_scores (prediction_id, match_id, user_id, points, tier)
    values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1, 'invalid_tier');
    raise exception 'check constraint não funcionou';
  exception when check_violation then null;
  end;
end $$;
```

Esperado: nenhum erro (a check constraint barra `invalid_tier` corretamente).

- [ ] **Step 4: Commit**

```bash
git add supabase/sql/008_prediction_scores.sql
git commit -m "feat(db): add prediction_scores table with RLS"
```

---

## Task 2: Função pura `computeScoreRows` (TDD)

**Files:**
- Test: `src/lib/scoring/__tests__/recompute-core.test.ts`
- Create: `src/lib/scoring/recompute-core.ts`

- [ ] **Step 1: Escrever testes falhos**

Criar `src/lib/scoring/__tests__/recompute-core.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  computeScoreRows,
  type MatchSnapshot,
  type PredictionSnapshot,
} from "@/lib/scoring/recompute-core";

const baseMatch: MatchSnapshot = {
  id: "match-1",
  stage: "group",
  home_score: 2,
  away_score: 1,
  status: null,
};

const preds = (xs: Array<{ id: string; user_id: string; h: number; a: number }>): PredictionSnapshot[] =>
  xs.map((x) => ({ id: x.id, user_id: x.user_id, home_score: x.h, away_score: x.a }));

describe("computeScoreRows", () => {
  it("resultado válido + N palpites → upsert com pontos certos", () => {
    const r = computeScoreRows(baseMatch, preds([
      { id: "p1", user_id: "u1", h: 2, a: 1 }, // exato → 7
      { id: "p2", user_id: "u2", h: 1, a: 0 }, // só vencedor → 2
      { id: "p3", user_id: "u3", h: 1, a: 2 }, // miss → 0
    ]));
    expect(r.kind).toBe("upsert");
    if (r.kind !== "upsert") throw new Error();
    expect(r.rows).toEqual([
      { prediction_id: "p1", match_id: "match-1", user_id: "u1", points: 7, tier: "exact" },
      { prediction_id: "p2", match_id: "match-1", user_id: "u2", points: 2, tier: "winner_or_draw" },
      { prediction_id: "p3", match_id: "match-1", user_id: "u3", points: 0, tier: "miss" },
    ]);
  });

  it("home_score null → kind: 'delete'", () => {
    expect(computeScoreRows({ ...baseMatch, home_score: null }, preds([
      { id: "p1", user_id: "u1", h: 0, a: 0 },
    ]))).toEqual({ kind: "delete" });
  });

  it("away_score null → kind: 'delete'", () => {
    expect(computeScoreRows({ ...baseMatch, away_score: null }, [])).toEqual({ kind: "delete" });
  });

  it("status='cancelled' → kind: 'delete' mesmo com placar", () => {
    expect(computeScoreRows({ ...baseMatch, status: "cancelled" }, preds([
      { id: "p1", user_id: "u1", h: 2, a: 1 },
    ]))).toEqual({ kind: "delete" });
  });

  it("status='postponed' → kind: 'delete' mesmo com placar", () => {
    expect(computeScoreRows({ ...baseMatch, status: "postponed" }, [])).toEqual({ kind: "delete" });
  });

  it("lista vazia de palpites + resultado válido → upsert com rows: []", () => {
    expect(computeScoreRows(baseMatch, [])).toEqual({ kind: "upsert", rows: [] });
  });

  it("usa stage da partida na pontuação (group=7 vs final=34 para exato)", () => {
    const groupResult = computeScoreRows(baseMatch, preds([
      { id: "p1", user_id: "u1", h: 2, a: 1 },
    ]));
    const finalResult = computeScoreRows({ ...baseMatch, id: "match-2", stage: "final" }, preds([
      { id: "p2", user_id: "u1", h: 2, a: 1 },
    ]));
    if (groupResult.kind !== "upsert" || finalResult.kind !== "upsert") throw new Error();
    expect(groupResult.rows[0].points).toBe(7);
    expect(finalResult.rows[0].points).toBe(34);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test`
Expected: falha em `recompute-core.test.ts` com module-not-found.

- [ ] **Step 3: Implementar `recompute-core.ts`**

Criar `src/lib/scoring/recompute-core.ts`:

```ts
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
  | { kind: "delete" }
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

  const rows: ScoreRow[] = predictions.map((p) => {
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

- [ ] **Step 4: Rodar testes e confirmar passam**

Run: `npm test`
Expected: 58 (SP-01) + 7 novos = **65 tests passing**.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring/recompute-core.ts src/lib/scoring/__tests__/recompute-core.test.ts
git commit -m "feat(scoring): pure computeScoreRows for materialization"
```

---

## Task 3: Função I/O `recomputeMatchScores`

**Files:**
- Create: `src/lib/scoring/recompute.ts`

- [ ] **Step 1: Criar `recompute.ts`**

Conteúdo:

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeScoreRows, type MatchSnapshot, type PredictionSnapshot } from "./recompute-core";

export async function recomputeMatchScores(matchId: string): Promise<{
  upserted: number;
  deleted: number;
}> {
  const started = Date.now();
  const admin = createAdminClient();

  const { data: match, error: mErr } = await admin
    .from("matches")
    .select("id, stage, home_score, away_score, status")
    .eq("id", matchId)
    .single<MatchSnapshot>();
  if (mErr) throw mErr;

  const { data: predictions, error: pErr } = await admin
    .from("predictions")
    .select("id, user_id, home_score, away_score")
    .eq("match_id", matchId)
    .returns<PredictionSnapshot[]>();
  if (pErr) throw pErr;

  const result = computeScoreRows(match, predictions ?? []);

  if (result.kind === "delete") {
    const { count, error } = await admin
      .from("prediction_scores")
      .delete({ count: "exact" })
      .eq("match_id", matchId);
    if (error) throw error;
    const out = { upserted: 0, deleted: count ?? 0 };
    console.log("[scoring] recomputeMatchScores", { matchId, ...out, durationMs: Date.now() - started });
    return out;
  }

  if (result.rows.length === 0) {
    const out = { upserted: 0, deleted: 0 };
    console.log("[scoring] recomputeMatchScores", { matchId, ...out, durationMs: Date.now() - started });
    return out;
  }

  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from("prediction_scores")
    .upsert(
      result.rows.map((r) => ({ ...r, scored_at: now })),
      { onConflict: "prediction_id" },
    );
  if (upErr) throw upErr;

  const out = { upserted: result.rows.length, deleted: 0 };
  console.log("[scoring] recomputeMatchScores", { matchId, ...out, durationMs: Date.now() - started });
  return out;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring/recompute.ts
git commit -m "feat(scoring): I/O recomputeMatchScores via admin client"
```

---

## Task 4: Hook em `updateMatch`

**Files:**
- Modify: `src/app/(authenticated)/admin/partidas/_actions.ts`

- [ ] **Step 1: Adicionar import**

No topo de `src/app/(authenticated)/admin/partidas/_actions.ts`, abaixo dos imports existentes:

```ts
import { recomputeMatchScores } from "@/lib/scoring/recompute";
```

- [ ] **Step 2: Inserir chamada após o `update`**

Em `updateMatch`, após `if (error) throw error;` e **antes** de `revalidatePath("/admin/partidas")`, inserir:

```ts
  await recomputeMatchScores(matchId);
```

O bloco final da função fica:

```ts
  const supabase = await createClient();
  const { error } = await supabase.from("matches").update(parsed.data).eq("id", matchId);
  if (error) throw error;

  await recomputeMatchScores(matchId);

  revalidatePath("/admin/partidas");
  revalidatePath(`/admin/partidas/${matchId}`);
  redirect("/admin/partidas");
```

- [ ] **Step 3: Typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem novos erros relacionados a `_actions.ts` ou `recompute.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/admin/partidas/_actions.ts
git commit -m "feat(admin): recompute scores on match result save"
```

---

## Task 5: Action `recomputeAllScores`

**Files:**
- Create: `src/app/(authenticated)/admin/_actions.ts`

- [ ] **Step 1: Criar arquivo da action**

Conteúdo de `src/app/(authenticated)/admin/_actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeMatchScores } from "@/lib/scoring/recompute";

export async function recomputeAllScores(): Promise<{
  matchesProcessed: number;
  upserted: number;
  deleted: number;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin", {
    uid: user.id,
  });
  if (rpcError) throw rpcError;
  if (!isAdmin) throw new Error("forbidden");

  const admin = createAdminClient();
  const { data: matches, error } = await admin.from("matches").select("id");
  if (error) throw error;

  let upserted = 0;
  let deleted = 0;
  for (const m of matches ?? []) {
    const r = await recomputeMatchScores(m.id);
    upserted += r.upserted;
    deleted += r.deleted;
  }

  revalidatePath("/admin");
  return { matchesProcessed: matches?.length ?? 0, upserted, deleted };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authenticated\)/admin/_actions.ts
git commit -m "feat(admin): recomputeAllScores action"
```

---

## Task 6: Card UI `RecomputeScoresCard`

**Files:**
- Create: `src/app/(authenticated)/admin/_components/recompute-scores-card.tsx`

- [ ] **Step 1: Criar componente**

Conteúdo de `src/app/(authenticated)/admin/_components/recompute-scores-card.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { recomputeAllScores } from "../_actions";

export function RecomputeScoresCard() {
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <h2 className="font-heading text-2xl tracking-wide">Pontuação</h2>
        <p className="text-sm text-muted-foreground">
          Recalcula os pontos de todos os palpites com base nos resultados oficiais
          registrados. Use após corrigir resultados ou alterar regras.
        </p>
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const r = await recomputeAllScores();
                toast.success(
                  `${r.matchesProcessed} partidas processadas — ${r.upserted} atualizados, ${r.deleted} removidos.`,
                );
              } catch {
                toast.error("Não foi possível recalcular as pontuações.");
              }
            })
          }
        >
          {pending ? "Recalculando..." : "Recalcular pontuações"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authenticated\)/admin/_components/recompute-scores-card.tsx
git commit -m "feat(admin): RecomputeScoresCard client component"
```

---

## Task 7: Inserir card no dashboard `/admin`

**Files:**
- Modify: `src/app/(authenticated)/admin/page.tsx`

- [ ] **Step 1: Importar o card**

No topo de `src/app/(authenticated)/admin/page.tsx`, junto aos demais imports:

```tsx
import { RecomputeScoresCard } from "./_components/recompute-scores-card";
```

- [ ] **Step 2: Substituir o card "Atividade recente" por `RecomputeScoresCard`**

No bloco `<section className="mt-8 grid gap-5 lg:grid-cols-2">`, substituir o segundo `<Card>` (o de "Atividade recente") por:

```tsx
<RecomputeScoresCard />
```

A seção fica:

```tsx
<section className="mt-8 grid gap-5 lg:grid-cols-2">
  <Card>
    <CardContent className="flex flex-col gap-4 p-6">
      <h2 className="font-heading text-2xl tracking-wide">
        Últimas partidas
      </h2>
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </CardContent>
  </Card>
  <RecomputeScoresCard />
</section>
```

- [ ] **Step 3: Typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem novos erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/admin/page.tsx
git commit -m "feat(admin): show RecomputeScoresCard on dashboard"
```

---

## Task 8: Verificação manual end-to-end

**Files:** nenhum (apenas validação).

- [ ] **Step 1: Suíte de testes**

Run: `npm test`
Expected: todos os testes verdes (≥ 65), sem skips.

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 3: Subir dev server**

Run: `npm run dev`
Esperado: `http://localhost:3000` sem erros.

- [ ] **Step 4: Caminho feliz — salvar resultado dispara recompute**

1. Logar como admin.
2. Ir em `/admin/partidas`, abrir uma partida que tenha **palpites já gravados** (verificar via Studio se necessário).
3. Preencher `home_score` e `away_score`, salvar.
4. No Supabase Studio, executar:
   ```sql
   select count(*), sum(points) from public.prediction_scores where match_id = '<uuid>';
   ```
   Esperado: 1 row por palpite gravado, com `points` coerente.
5. Reabrir a partida, alterar o placar, salvar de novo. Re-rodar a query: pontos atualizados (idempotência).

- [ ] **Step 5: Resultado nulo apaga scores**

1. Editar a mesma partida; apagar `home_score` e `away_score`.
2. Salvar.
3. No Studio: `select count(*) from public.prediction_scores where match_id = '<uuid>';` → **0**.

- [ ] **Step 6: Status `cancelled` apaga scores**

1. Salvar a partida com placar válido (gera scores).
2. Editar e marcar `status='cancelled'` (sem mudar placar).
3. Verificar count = 0.

- [ ] **Step 7: Botão "Recalcular pontuações" no dashboard**

1. Acessar `/admin`.
2. Card "Pontuação" deve aparecer ao lado de "Últimas partidas".
3. Clicar em "Recalcular pontuações".
4. Botão fica `disabled` com texto "Recalculando..."; ao terminar, toast verde com totais.
5. Verificar via Studio que `prediction_scores` foi reconciliada.

- [ ] **Step 8: Bloqueio para usuário comum**

1. Logar como usuário com `role='usuario'`.
2. Tentar acessar `/admin` → barrado pelo layout existente (sem regressão).
3. Tentar invocar a action via console (opcional): deve falhar com `forbidden`.

- [ ] **Step 9: Sem regressões**

Visitar `/admin/usuarios`, `/admin/times`, `/admin/partidas`, `/palpites` → carregam normalmente.

---

## Done criteria

- [x] Tabela `prediction_scores` criada com RLS pública select + admin write.
- [x] `computeScoreRows` puro, com 7 testes verdes.
- [x] `recomputeMatchScores` (I/O) integrada em `updateMatch`.
- [x] `recomputeAllScores` action validando admin via `is_admin` RPC.
- [x] Card "Pontuação" no dashboard `/admin` com botão funcional.
- [x] Salvar resultado de partida persiste scores; resultado nulo / `cancelled` / `postponed` apaga.
- [x] Re-salvar é idempotente.
- [x] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` passam.
- [x] Verificação manual end-to-end concluída.
