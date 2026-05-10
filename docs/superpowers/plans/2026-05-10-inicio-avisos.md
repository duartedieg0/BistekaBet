# Página /inicio — Componente Avisos + redesign de "Sua posição" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o card mockado "Aposta da rodada" por um `AvisosCard` (Atenção: pagamento pendente, countdown <24h, palpites pendentes; Informação: aguardando resultado, pontos ganhos) e tirar o card lateral "Sua posição" do mock (rank real + cravados).

**Architecture:** Tudo server component exceto `NextMatchCountdown` (client com `setInterval`). Helpers puros isolados (`computePointsPossible`, `formatCountdown`) cobertos por TDD. Dois orquestradores de fetch (`loadAvisosData`, `loadSuaPosicaoData`) que disparam queries em paralelo via `Promise.all`. Sem cache server-side; sem dismissal/persistência.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Supabase (`@supabase/supabase-js`), Tailwind, shadcn/ui, lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-10-inicio-avisos-design.md`

---

## File Structure

**Criar:**
- `src/app/(authenticated)/inicio/_lib/format-countdown.ts` — `formatCountdown(ms): string`.
- `src/app/(authenticated)/inicio/_lib/__tests__/format-countdown.test.ts`.
- `src/app/(authenticated)/inicio/_lib/avisos-queries.ts` — `computePointsPossible`, `loadAvisosData`, type `AvisosData`.
- `src/app/(authenticated)/inicio/_lib/__tests__/compute-points-possible.test.ts`.
- `src/app/(authenticated)/inicio/_lib/sua-posicao-queries.ts` — `loadSuaPosicaoData`, type `SuaPosicaoData`.
- `src/app/(authenticated)/inicio/_components/avisos/payment-warning.tsx` (server).
- `src/app/(authenticated)/inicio/_components/avisos/next-match-countdown.tsx` (client).
- `src/app/(authenticated)/inicio/_components/avisos/__tests__/next-match-countdown.test.tsx`.
- `src/app/(authenticated)/inicio/_components/avisos/pending-predictions.tsx` (server).
- `src/app/(authenticated)/inicio/_components/avisos/awaiting-results.tsx` (server).
- `src/app/(authenticated)/inicio/_components/avisos/points-progress.tsx` (server).
- `src/app/(authenticated)/inicio/_components/avisos/tudo-em-dia.tsx` (server).
- `src/app/(authenticated)/inicio/_components/avisos-card.tsx` (server).
- `src/app/(authenticated)/inicio/_components/sua-posicao-card.tsx` (server).

**Modificar:**
- `src/app/(authenticated)/inicio/page.tsx` — substituir os dois `<Card>` laterais pelos novos componentes; limpar imports.

---

## Task 1: `formatCountdown` helper

**Files:**
- Create: `src/app/(authenticated)/inicio/_lib/format-countdown.ts`
- Test: `src/app/(authenticated)/inicio/_lib/__tests__/format-countdown.test.ts`

- [ ] **Step 1.1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { formatCountdown } from "@/app/(authenticated)/inicio/_lib/format-countdown";

describe("formatCountdown", () => {
  it(">= 1h: HH:MM:SS com zero-pad", () => {
    expect(formatCountdown(2 * 3600_000 + 43 * 60_000 + 17 * 1000)).toBe("02:43:17");
    expect(formatCountdown(60 * 60_000)).toBe("01:00:00");
    expect(formatCountdown(10 * 3600_000)).toBe("10:00:00");
  });

  it("< 1h e >= 0: MM:SS", () => {
    expect(formatCountdown(43 * 60_000 + 17 * 1000)).toBe("43:17");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(999)).toBe("00:00"); // <1s arredonda pra baixo
  });

  it("ms negativo: 00:00", () => {
    expect(formatCountdown(-1)).toBe("00:00");
    expect(formatCountdown(-99999)).toBe("00:00");
  });
});
```

- [ ] **Step 1.2: Run, expect FAIL**

```bash
npx vitest run "src/app/(authenticated)/inicio/_lib/__tests__/format-countdown.test.ts"
```

Expected: FAIL (módulo não existe).

- [ ] **Step 1.3: Implement**

```ts
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h >= 1) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}
```

- [ ] **Step 1.4: Run, expect PASS**

`npx vitest run "src/app/(authenticated)/inicio/_lib/__tests__/format-countdown.test.ts"` → 3 specs passando.

- [ ] **Step 1.5: Commit**

```bash
git add "src/app/(authenticated)/inicio/_lib/format-countdown.ts" "src/app/(authenticated)/inicio/_lib/__tests__/format-countdown.test.ts"
git commit -m "feat(inicio): add formatCountdown helper for live countdown"
```

---

## Task 2: `computePointsPossible` helper

**Files:**
- Create: `src/app/(authenticated)/inicio/_lib/avisos-queries.ts` (apenas o helper nesta task; a função `loadAvisosData` vem na Task 3).
- Test: `src/app/(authenticated)/inicio/_lib/__tests__/compute-points-possible.test.ts`

- [ ] **Step 2.1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { computePointsPossible } from "@/app/(authenticated)/inicio/_lib/avisos-queries";
import { POINTS_TABLE } from "@/lib/scoring/points-table";

describe("computePointsPossible", () => {
  it("soma POINTS_TABLE[stage].exact por match finalizado", () => {
    const matches = [
      { stage: "group" as const },
      { stage: "group" as const },
      { stage: "group" as const },
      { stage: "final" as const },
    ];
    expect(computePointsPossible(matches)).toBe(
      3 * POINTS_TABLE.group.exact + 1 * POINTS_TABLE.final.exact,
    );
  });

  it("lista vazia → 0", () => {
    expect(computePointsPossible([])).toBe(0);
  });

  it("mistura várias fases", () => {
    const matches = [
      { stage: "round_of_16" as const },
      { stage: "quarter" as const },
      { stage: "semi" as const },
    ];
    expect(computePointsPossible(matches)).toBe(
      POINTS_TABLE.round_of_16.exact +
        POINTS_TABLE.quarter.exact +
        POINTS_TABLE.semi.exact,
    );
  });
});
```

- [ ] **Step 2.2: Run, expect FAIL**

`npx vitest run "src/app/(authenticated)/inicio/_lib/__tests__/compute-points-possible.test.ts"` → FAIL (módulo não existe).

- [ ] **Step 2.3: Implement (file with just this helper for now)**

`src/app/(authenticated)/inicio/_lib/avisos-queries.ts`:

```ts
import type { Stage } from "@/lib/types/match";
import { POINTS_TABLE } from "@/lib/scoring/points-table";

export function computePointsPossible(matches: { stage: Stage }[]): number {
  let total = 0;
  for (const m of matches) {
    total += POINTS_TABLE[m.stage].exact;
  }
  return total;
}
```

- [ ] **Step 2.4: Run, expect PASS**

`npx vitest run "src/app/(authenticated)/inicio/_lib/__tests__/compute-points-possible.test.ts"` → 3 specs passando.

- [ ] **Step 2.5: Commit**

```bash
git add "src/app/(authenticated)/inicio/_lib/avisos-queries.ts" "src/app/(authenticated)/inicio/_lib/__tests__/compute-points-possible.test.ts"
git commit -m "feat(inicio): add computePointsPossible helper"
```

---

## Task 3: `loadAvisosData` — orquestrador de queries

**Files:**
- Modify: `src/app/(authenticated)/inicio/_lib/avisos-queries.ts` (adicionar a função e o type ao arquivo da Task 2).

Sem teste unitário (segue o padrão do projeto para queries Supabase, e.g., `_lib/queries.ts` da home, `palpites/_lib/queries.ts`). Os helpers puros já são testados isoladamente.

- [ ] **Step 3.1: Adicionar `AvisosData` type e `loadAvisosData`**

Editar `avisos-queries.ts` mantendo `computePointsPossible` intacto:
- **Adicionar imports no topo do arquivo** (junto dos imports já existentes da Task 2):
  ```ts
  import type { SupabaseClient } from "@supabase/supabase-js";
  import { getInicioDayMatches } from "./queries";
  ```
- **Adicionar o restante** (constante, tipos, helper privado e `loadAvisosData`) **abaixo** de `computePointsPossible`.

Bloco para adicionar (sem repetir os imports já listados):

```ts

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export type AvisosData = {
  paid: boolean;
  nextUnpredictedMatch: {
    id: string;
    homeCode: string;
    awayCode: string;
    kickoffAt: string;
  } | null;
  pendingPredictionsCount: number;
  awaitingResultsCount: number;
  pointsEarned: number;
  pointsPossible: number;
};

type NextMatchRow = {
  id: string;
  kickoff_at: string;
  home_team: { code: string } | null;
  away_team: { code: string } | null;
  predictions: { id: string }[] | null;
};

type AwaitingRow = {
  id: string;
  prediction_scores: { id: string }[] | null;
  matches: { kickoff_at: string } | null;
};

type FinalizedMatchRow = {
  stage: Stage;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
};

// "Finalizado" segundo o spec: placar oficial preenchido E status NÃO é postponed/cancelled.
// Outros valores possíveis (null, "rescheduled") contam como finalizados.
function isFinalized(row: { home_score: number | null; away_score: number | null; status: string | null }): boolean {
  if (row.home_score === null || row.away_score === null) return false;
  if (row.status === "postponed" || row.status === "cancelled") return false;
  return true;
}

export async function loadAvisosData(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<AvisosData> {
  const nowIso = now.toISOString();
  const upperIso = new Date(now.getTime() + TWENTY_FOUR_HOURS_MS).toISOString();

  const paidP = supabase
    .from("profiles")
    .select("paid")
    .eq("id", userId)
    .maybeSingle();

  const nextUnpredictedP = supabase
    .from("matches")
    .select(
      `id, kickoff_at,
       home_team:home_team_id(code),
       away_team:away_team_id(code),
       predictions!left(id)`,
    )
    .eq("predictions.user_id", userId)
    .gt("kickoff_at", nowIso)
    .lte("kickoff_at", upperIso)
    .order("kickoff_at", { ascending: true })
    .limit(10);

  const dayMatchesP = getInicioDayMatches(supabase, userId, now);

  const awaitingP = supabase
    .from("predictions")
    .select(
      "id, prediction_scores!left(id), matches!inner(kickoff_at)",
      { count: "exact", head: true },
    )
    .eq("user_id", userId)
    .is("prediction_scores.id", null)
    .lte("matches.kickoff_at", nowIso);

  const earnedP = supabase
    .from("prediction_scores")
    .select("points")
    .eq("user_id", userId);

  const finalizedP = supabase
    .from("matches")
    .select("stage, status, home_score, away_score");

  const [paidR, nextR, dayR, awaitingR, earnedR, finalizedR] = await Promise.all([
    paidP, nextUnpredictedP, dayMatchesP, awaitingP, earnedP, finalizedP,
  ]);

  if (paidR.error) throw paidR.error;
  if (nextR.error) throw nextR.error;
  if (awaitingR.error) throw awaitingR.error;
  if (earnedR.error) throw earnedR.error;
  if (finalizedR.error) throw finalizedR.error;

  const paid = paidR.data?.paid ?? false;

  const nextRows = (nextR.data ?? []) as unknown as NextMatchRow[];
  const firstUnpredicted = nextRows.find(
    (r) => !r.predictions || r.predictions.length === 0,
  );
  const nextUnpredictedMatch = firstUnpredicted
    ? {
        id: firstUnpredicted.id,
        homeCode: firstUnpredicted.home_team?.code ?? "TBD",
        awayCode: firstUnpredicted.away_team?.code ?? "TBD",
        kickoffAt: firstUnpredicted.kickoff_at,
      }
    : null;

  const pendingPredictionsCount = dayR.matches.filter(
    (m) => m.prediction === null,
  ).length;

  const awaitingResultsCount = awaitingR.count ?? 0;

  const earnedRows = (earnedR.data ?? []) as { points: number }[];
  const pointsEarned = earnedRows.reduce((acc, r) => acc + (r.points ?? 0), 0);

  const finalizedRows = ((finalizedR.data ?? []) as FinalizedMatchRow[]).filter(isFinalized);
  const pointsPossible = computePointsPossible(finalizedRows.map((r) => ({ stage: r.stage })));

  return {
    paid,
    nextUnpredictedMatch,
    pendingPredictionsCount,
    awaitingResultsCount,
    pointsEarned,
    pointsPossible,
  };
}
```

> Resumo dos imports a adicionar no topo do arquivo: `import type { SupabaseClient } from "@supabase/supabase-js";` e `import { getInicioDayMatches } from "./queries";`. O import de `Stage` e `POINTS_TABLE` já existem da Task 2.

- [ ] **Step 3.2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. Se Supabase reclamar de tipo nas embeds (`home_team:home_team_id(code)`), o cast `as unknown as NextMatchRow[]` resolve. Se o `count`/`head` da query 4 não digitar, validar com `head:true` retorna `count` mas `data` é null — o código já trata.

- [ ] **Step 3.3: Commit**

```bash
git add "src/app/(authenticated)/inicio/_lib/avisos-queries.ts"
git commit -m "feat(inicio): add loadAvisosData orchestrating 6 parallel queries"
```

---

## Task 4: `loadSuaPosicaoData`

**Files:**
- Create: `src/app/(authenticated)/inicio/_lib/sua-posicao-queries.ts`

- [ ] **Step 4.1: Implement**

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadRanking } from "@/lib/scoring/ranking";

export type SuaPosicaoData = {
  rank: number;
  totalPlayers: number;
  totalPoints: number;
  exactCount: number;
};

export async function loadSuaPosicaoData(userId: string): Promise<SuaPosicaoData> {
  const supabase = await createClient();

  const [ranking, exactRes] = await Promise.all([
    loadRanking(),
    supabase
      .from("prediction_scores")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("tier", "exact"),
  ]);

  if (exactRes.error) throw exactRes.error;

  const row = ranking.find((r) => r.user_id === userId);
  const rank = row?.rank ?? ranking.length + 1;
  const totalPoints = row?.total_points ?? 0;
  const totalPlayers = ranking.length;
  const exactCount = exactRes.count ?? 0;

  return { rank, totalPlayers, totalPoints, exactCount };
}
```

> **Nota:** `loadRanking()` já é `server-only` e cria seu próprio Supabase client. Este helper segue o mesmo padrão.

- [ ] **Step 4.2: Type-check**

`npx tsc --noEmit` → 0 errors.

- [ ] **Step 4.3: Commit**

```bash
git add "src/app/(authenticated)/inicio/_lib/sua-posicao-queries.ts"
git commit -m "feat(inicio): add loadSuaPosicaoData helper"
```

---

## Task 5: Avisos simples (server) — 5 componentes pequenos

**Files (todos no diretório `src/app/(authenticated)/inicio/_components/avisos/`):**
- `payment-warning.tsx`
- `pending-predictions.tsx`
- `awaiting-results.tsx`
- `points-progress.tsx`
- `tudo-em-dia.tsx`

São componentes server estáticos (sem testes individuais — comportamento trivial).

- [ ] **Step 5.1: `payment-warning.tsx`**

```tsx
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export function PaymentWarning() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Pagamento pendente</span>
        <span className="text-muted-foreground">
          Sua inscrição precisa ser confirmada.{" "}
          <Link href="/regulamento" className="underline underline-offset-2 hover:text-foreground">
            Como pagar?
          </Link>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.2: `pending-predictions.tsx`**

```tsx
import Link from "next/link";
import { ListTodo } from "lucide-react";

export function PendingPredictions({ count }: { count: number }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border/60 p-3">
      <ListTodo className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">
          {count} palpite{count === 1 ? "" : "s"} pendente{count === 1 ? "" : "s"}
        </span>
        <Link href="/palpites" className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Palpitar agora
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.3: `awaiting-results.tsx`**

```tsx
import { Hourglass } from "lucide-react";

export function AwaitingResults({ count }: { count: number }) {
  return (
    <div className="flex items-start gap-3 text-sm text-muted-foreground">
      <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        {count} jogo{count === 1 ? "" : "s"} aguardando resultado oficial
      </span>
    </div>
  );
}
```

- [ ] **Step 5.4: `points-progress.tsx`**

```tsx
export function PointsProgress({ earned, possible }: { earned: number; possible: number }) {
  if (possible === 0) return null;
  const percent = Math.round((earned / possible) * 100);
  return (
    <div className="flex flex-col gap-1">
      <span className="font-heading text-4xl text-primary tabular leading-none">{percent}%</span>
      <span className="text-xs text-muted-foreground">
        {earned} de {possible} pts possíveis
      </span>
    </div>
  );
}
```

- [ ] **Step 5.5: `tudo-em-dia.tsx`**

```tsx
import { CheckCircle2 } from "lucide-react";

export function TudoEmDia() {
  return (
    <div className="flex items-start gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Tudo em dia</span>
        <span className="text-muted-foreground">Você não tem pendências.</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.6: Type-check**

`npx tsc --noEmit` → 0 errors.

- [ ] **Step 5.7: Commit**

```bash
git add "src/app/(authenticated)/inicio/_components/avisos/"
git commit -m "feat(inicio): add static avisos sub-components"
```

---

## Task 6: `NextMatchCountdown` (client)

**Files:**
- Create: `src/app/(authenticated)/inicio/_components/avisos/next-match-countdown.tsx`

**Sem teste de componente.** Razão: o projeto não tem `@testing-library/react`, `jsdom`, nem `@testing-library/jest-dom` instalados, e `vitest.config.ts` está em `environment: "node"` com `include: ["src/**/__tests__/**/*.test.ts"]` (não pega `.test.tsx`). A lógica de tempo do componente já é coberta por `formatCountdown` (Task 1); o componente em si é glue (`useEffect` + `setInterval`). Cobertura adicional fica para o smoke manual da Task 10. Se quiser instalar testing-library no futuro, é spec separado.

- [ ] **Step 6.1: Implement**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formatCountdown } from "../../_lib/format-countdown";

type Match = {
  id: string;
  homeCode: string;
  awayCode: string;
  kickoffAt: string;
};

export function NextMatchCountdown({ match }: { match: Match }) {
  const [label, setLabel] = useState<string>("--:--:--");

  useEffect(() => {
    const kickoffMs = new Date(match.kickoffAt).getTime();
    const tick = () => setLabel(formatCountdown(kickoffMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [match.kickoffAt]);

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-red-500/40 bg-red-500/10 p-3"
    >
      <Timer className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden />
      <div className="flex flex-col gap-1 text-sm">
        <span
          aria-live="polite"
          className="font-heading text-2xl text-foreground tabular-nums leading-none"
        >
          {label}
        </span>
        <span className="text-muted-foreground">
          {match.homeCode} × {match.awayCode} · você ainda não palpitou
        </span>
      </div>
    </div>
  );
}
```

> Nota: `aria-live="polite"` está no `<span>` do número (alinhado com o spec) — leitor anuncia mudanças do tempo sem bombardear, mas o role do container é `status`.

- [ ] **Step 6.2: Type-check**

`npx tsc --noEmit` → 0 errors.

- [ ] **Step 6.3: Commit**

```bash
git add "src/app/(authenticated)/inicio/_components/avisos/next-match-countdown.tsx"
git commit -m "feat(inicio): add NextMatchCountdown client component with live timer"
```

---

## Task 7: `AvisosCard` (server orchestrator)

**Files:**
- Create: `src/app/(authenticated)/inicio/_components/avisos-card.tsx`

- [ ] **Step 7.1: Implement**

```tsx
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { loadAvisosData } from "../_lib/avisos-queries";
import { PaymentWarning } from "./avisos/payment-warning";
import { NextMatchCountdown } from "./avisos/next-match-countdown";
import { PendingPredictions } from "./avisos/pending-predictions";
import { AwaitingResults } from "./avisos/awaiting-results";
import { PointsProgress } from "./avisos/points-progress";
import { TudoEmDia } from "./avisos/tudo-em-dia";

export async function AvisosCard() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const data = await loadAvisosData(supabase, userData.user.id);

  const hasAttention =
    !data.paid ||
    data.nextUnpredictedMatch !== null ||
    data.pendingPredictionsCount > 0;

  const hasInfo = data.awaitingResultsCount > 0 || data.pointsPossible > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 font-heading text-xl tracking-wide">
          <Bell className="size-5 text-primary" />
          Avisos
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Atenção
          </h3>
          {hasAttention ? (
            <div className="flex flex-col gap-2">
              {!data.paid && <PaymentWarning />}
              {data.nextUnpredictedMatch && (
                <NextMatchCountdown match={data.nextUnpredictedMatch} />
              )}
              {data.pendingPredictionsCount > 0 && (
                <PendingPredictions count={data.pendingPredictionsCount} />
              )}
            </div>
          ) : (
            <TudoEmDia />
          )}
        </section>

        {hasInfo && (
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Informação
            </h3>
            <div className="flex flex-col gap-3">
              {data.awaitingResultsCount > 0 && (
                <AwaitingResults count={data.awaitingResultsCount} />
              )}
              {data.pointsPossible > 0 && (
                <PointsProgress
                  earned={data.pointsEarned}
                  possible={data.pointsPossible}
                />
              )}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7.2: Type-check**

`npx tsc --noEmit` → 0 errors.

- [ ] **Step 7.3: Commit**

```bash
git add "src/app/(authenticated)/inicio/_components/avisos-card.tsx"
git commit -m "feat(inicio): add AvisosCard orchestrating attention/info notices"
```

---

## Task 8: `SuaPosicaoCard` (server)

**Files:**
- Create: `src/app/(authenticated)/inicio/_components/sua-posicao-card.tsx`

- [ ] **Step 8.1: Implement**

```tsx
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { loadSuaPosicaoData } from "../_lib/sua-posicao-queries";

export async function SuaPosicaoCard() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const { rank, totalPlayers, totalPoints, exactCount } = await loadSuaPosicaoData(
    userData.user.id,
  );
  const hasPalpitado = totalPoints > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 font-heading text-xl tracking-wide">
          <Trophy className="size-5 text-primary" />
          Sua posição
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <span className="font-heading text-6xl text-primary tabular leading-none">
          {hasPalpitado ? `#${rank}` : "#—"}
        </span>
        {hasPalpitado ? (
          <span className="text-sm text-muted-foreground">
            de {totalPlayers} · {exactCount} cravado{exactCount === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            Você ainda não palpitou. Comece pela primeira partida para entrar no
            ranking.
          </span>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 8.2: Type-check**

`npx tsc --noEmit` → 0 errors.

- [ ] **Step 8.3: Commit**

```bash
git add "src/app/(authenticated)/inicio/_components/sua-posicao-card.tsx"
git commit -m "feat(inicio): add SuaPosicaoCard with real rank and exact count"
```

---

## Task 9: Wire em `page.tsx`

**Files:**
- Modify: `src/app/(authenticated)/inicio/page.tsx`

Substituir os dois `<Card>` laterais (Sua posição mockada com `#—` e Aposta da rodada com Skeleton) pelos novos componentes. Limpar imports.

- [ ] **Step 9.1: Editar**

**Antes de tudo:** ler o arquivo atual com `Read` e confirmar quais imports continuam em uso após a substituição. A lista abaixo reflete o estado conhecido (após implementação da Task 9 do plano anterior); confirme com a leitura.

1. Substituir imports (verificar uso antes de remover cada um):
   - REMOVER: `Flame`, `Trophy` de `lucide-react` (Trophy passa a ser usado dentro de `SuaPosicaoCard`; Flame era do "Aposta da rodada").
   - REMOVER: `Skeleton` (era usado só pela "Aposta da rodada").
   - REMOVER: `Card`, `CardContent`, `CardHeader`, `CardTitle` (somente os Cards laterais usavam; o resto da página não envolve em `<Card>`).
   - MANTER: `Badge` (usado pelo `<Badge variant="upcoming">Pré-Copa</Badge>` no header).
   - ADICIONAR: `import { SuaPosicaoCard } from "./_components/sua-posicao-card";`
   - ADICIONAR: `import { AvisosCard } from "./_components/avisos-card";`

> Se o `Read` mostrar algum import sendo usado fora do que está documentado acima (pouco provável), **mantenha-o** e reporte a divergência.

2. Substituir o bloco `<div className="flex flex-col gap-5">...</div>` pela versão com os novos componentes.

Resultado da seção:

```tsx
<section className="grid gap-5 lg:grid-cols-[2fr_1fr]">
  <UpcomingMatchesSection />

  <div className="flex flex-col gap-5">
    <SuaPosicaoCard />
    <AvisosCard />
  </div>
</section>
```

> Importante: `<header>`, `<RankingPreview />`, e a layout grid permanecem intocados.

- [ ] **Step 9.2: Type-check + lint**

```bash
npx tsc --noEmit && npx eslint "src/app/(authenticated)/inicio/page.tsx"
```

Expected: 0 errors. Lint warning aceitável; novos errors não.

- [ ] **Step 9.3: Build smoke**

```bash
npx next build
```

Expected: build succeeds. Se falhar por env var de Supabase ausente no build local, NÃO é falha desta task; reporte.

- [ ] **Step 9.4: Commit**

```bash
git add "src/app/(authenticated)/inicio/page.tsx"
git commit -m "feat(inicio): wire SuaPosicaoCard and AvisosCard into home page"
```

---

## Task 10: Suite final + smoke

- [ ] **Step 10.1: Suite vitest**

```bash
npm test
```

Expected: TODOS os testes passando — `formatCountdown` (3) + `computePointsPossible` (3) novos + 87 pré-existentes = 93. Sem regressões.

- [ ] **Step 10.2: Type-check final**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 10.3: Smoke manual (humano)**

Não automatizável aqui. O implementer deve **reportar** ao controlador para o humano executar:

1. `npm run dev`
2. Abrir `/inicio` autenticado em diferentes estados:
   - Usuário não-pago: deve ver `PaymentWarning`.
   - Usuário pago, com 0 pendências: deve ver `TudoEmDia`.
   - Usuário com palpites pendentes hoje: contador correto.
   - Próximo jogo <24h sem palpite: countdown vivo, atualiza a cada segundo.
   - Usuário com pontos: bloco percentual + total.
3. Confirmar que `Sua posição` mostra rank real, `de X · Y cravados`.

---

## Checklist final de scope

- [ ] `formatCountdown` e `computePointsPossible` testados.
- [ ] `loadAvisosData` faz 6 queries paralelas e retorna `AvisosData` com tipos completos.
- [ ] `loadSuaPosicaoData` usa `loadRanking()`, retorna `rank`/`total_points` direto (sem `index+1`).
- [ ] 6 sub-componentes Avisos criados.
- [ ] `NextMatchCountdown` é o único client component, com placeholder no SSR.
- [ ] `AvisosCard` renderiza Atenção (com `TudoEmDia` no empty state) e Informação (omitida quando vazia).
- [ ] `SuaPosicaoCard` mostra `#—` apenas quando `totalPoints === 0`.
- [ ] `page.tsx` enxuto: header + grid + 3 componentes (`UpcomingMatchesSection`, `SuaPosicaoCard`, `AvisosCard`) + `RankingPreview`.
- [ ] Build passa, suite passa, TS clean.
