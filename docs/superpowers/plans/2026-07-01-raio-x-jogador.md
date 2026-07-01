# Raio-X do jogador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a página pessoal `/raio-x`, que mostra a trajetória de posição (rank) e pontos do usuário logado ao longo da Copa 2026, dia a dia.

**Architecture:** Um Server Component (`page.tsx`) chama `loadRaioX(userId)` (server-only), que carrega todos os `prediction_scores` (paginados) + profiles e delega a uma função pura testável `buildRaioXTimeline` que **reconstrói** o ranking acumulado por dia São Paulo, reusando `applyScoreToEntry`/`compareForRanking`/`assignRanks` do motor de ranking existente. O gráfico de posição é uma ilha `"use client"` com recharts; cards e tabela são renderizados no server.

**Tech Stack:** Next.js 16 (App Router, RSC), Supabase (PostgREST), TypeScript, shadcn/ui + `@base-ui/react`, Tailwind v4, lucide-react, **recharts v3** (nova dependência), vitest.

**Spec:** `docs/superpowers/specs/2026-07-01-raio-x-jogador-design.md`

---

## File Structure

**Criar:**
- `src/lib/scoring/raio-x-core.ts` — função pura `buildRaioXTimeline` + tipos (`TimelinePoint`, `RaioXHighlights`, `RaioXResult`, `RaioXScore`).
- `src/lib/scoring/__tests__/raio-x-core.test.ts` — testes da função pura.
- `src/lib/scoring/raio-x.ts` — `loadRaioX(userId)` (server-only, queries Supabase).
- `src/app/(authenticated)/raio-x/page.tsx` — RSC que monta a página.
- `src/app/(authenticated)/raio-x/_components/rank-timeline-chart.tsx` — ilha `"use client"` (recharts).
- `src/app/(authenticated)/raio-x/_components/highlight-cards.tsx` — server, grid de Card.
- `src/app/(authenticated)/raio-x/_components/daily-table.tsx` — server, Table.
- `src/app/(authenticated)/raio-x/_components/raio-x-empty.tsx` — estado vazio.
- `src/components/variation-arrow.tsx` — componente de seta ↑/↓ compartilhado.

**Modificar:**
- `src/lib/dates/sao-paulo-day.ts` — exportar helpers `saoPauloDay(iso)` e `formatDayDdMm(day)`.
- `src/lib/dates/__tests__/sao-paulo-day.test.ts` — testes do novo helper.
- `src/app/(authenticated)/partidas/[matchId]/_components/prediction-row.tsx` — usar `VariationArrow` (remove duplicação).
- `src/app/(authenticated)/_components/auth-header.tsx` — novo item no array `NAV`.
- `src/app/(authenticated)/inicio/_components/sua-posicao-card.tsx` — link "Ver meu raio-x".
- `package.json` / `package-lock.json` — dependência recharts.

**Comandos de referência:**
- Rodar um teste: `npx vitest run <caminho-do-teste>`
- Todos os testes: `npm test`
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`
- Build: `npm run build`

---

## Task 1: Helpers de data `saoPauloDay` e `formatDayDdMm` (TDD)

`saoPauloDay(iso)` deriva o dia calendário São Paulo (`YYYY-MM-DD`) de um ISO timestamp, reusando o formatador já testado. **Não** usar `new Date(iso).toISOString().slice(0,10)` (bucketiza por UTC e quebra a meia-noite). `formatDayDdMm(day)` formata um `YYYY-MM-DD` como `dd/mm` (usado por gráfico, cards e tabela — evita duplicação em 3 componentes).

**Files:**
- Modify: `src/lib/dates/sao-paulo-day.ts`
- Test: `src/lib/dates/__tests__/sao-paulo-day.test.ts`

REQUIRED SUB-SKILL: @superpowers:test-driven-development

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim de `src/lib/dates/__tests__/sao-paulo-day.test.ts` (dentro do arquivo existente; ajustar o import no topo para incluir `saoPauloDay`):

```ts
import { saoPauloDay } from "@/lib/dates/sao-paulo-day";

describe("saoPauloDay", () => {
  it("jogo de dia cai no dia São Paulo correto", () => {
    // 2026-06-11T19:00Z → SP 16:00 → 2026-06-11
    expect(saoPauloDay("2026-06-11T19:00:00Z")).toBe("2026-06-11");
  });

  it("antes da meia-noite SP fica no dia anterior ao UTC", () => {
    // 2026-06-12T02:00Z → SP 23:00 do dia 11 → 2026-06-11
    expect(saoPauloDay("2026-06-12T02:00:00Z")).toBe("2026-06-11");
  });

  it("meia-noite SP vira o dia seguinte", () => {
    // 2026-06-12T03:00Z → SP 00:00 do dia 12 → 2026-06-12
    expect(saoPauloDay("2026-06-12T03:00:00Z")).toBe("2026-06-12");
  });
});

import { formatDayDdMm } from "@/lib/dates/sao-paulo-day";

describe("formatDayDdMm", () => {
  it("formata YYYY-MM-DD como dd/mm", () => {
    expect(formatDayDdMm("2026-06-11")).toBe("11/06");
    expect(formatDayDdMm("2026-07-01")).toBe("01/07");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dates/__tests__/sao-paulo-day.test.ts`
Expected: FAIL (`saoPauloDay` não existe / não exportado).

- [ ] **Step 3: Implementar**

Adicionar ao `src/lib/dates/sao-paulo-day.ts` (pode ficar após `toSaoPauloInputValue`; declarações de função são içadas):

```ts
/** Dia calendário São Paulo (YYYY-MM-DD) de um ISO timestamp. */
export function saoPauloDay(iso: string): string {
  return toSaoPauloInputValue(iso).slice(0, 10);
}

/** Formata um dia calendário "YYYY-MM-DD" como "dd/mm" (sem conversão de fuso). */
export function formatDayDdMm(day: string): string {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dates/__tests__/sao-paulo-day.test.ts`
Expected: PASS (todos, incluindo os pré-existentes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates/sao-paulo-day.ts src/lib/dates/__tests__/sao-paulo-day.test.ts
git commit -m "feat(dates): helpers saoPauloDay e formatDayDdMm"
```

---

## Task 2: Core puro `buildRaioXTimeline` (TDD)

Reconstrói o rank acumulado por dia e monta timeline + highlights. Reusa `applyScoreToEntry`/`compareForRanking`/`assignRanks` do `ranking-core.ts`.

**Files:**
- Create: `src/lib/scoring/raio-x-core.ts`
- Test: `src/lib/scoring/__tests__/raio-x-core.test.ts`

REQUIRED SUB-SKILL: @superpowers:test-driven-development

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/scoring/__tests__/raio-x-core.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildRaioXTimeline, type RaioXScore } from "@/lib/scoring/raio-x-core";
import type { ProfileRow } from "@/lib/scoring/ranking-core";

const profile = (id: string): ProfileRow => ({
  id, display_name: id, avatar_url: null, paid: true,
});

const sc = (
  user_id: string, points: number,
  tier: RaioXScore["tier"], stage: RaioXScore["stage"], day: string,
): RaioXScore => ({ user_id, points, tier, stage, day });

// Cenário base (usuário "a", concorrente "b"):
//  11/06: a +7 exact group  | b +4 winner group   → a=7(#1), b=4(#2)
//  12/06:                    | b +10 exact group   → a=7(#2), b=14(#1)
//  13/06: a +13 exact R16    |                      → a=20(#1), b=14(#2)
const base: RaioXScore[] = [
  sc("a", 7, "exact", "group", "2026-06-11"),
  sc("b", 4, "winner_or_draw", "group", "2026-06-11"),
  sc("b", 10, "exact", "group", "2026-06-12"),
  sc("a", 13, "exact", "round_of_16", "2026-06-13"),
];

describe("buildRaioXTimeline", () => {
  it("reconstrói rank e pontos acumulados por dia", () => {
    const { timeline } = buildRaioXTimeline({
      userId: "a", profiles: [profile("a"), profile("b")], scores: base,
    });
    expect(timeline.map((t) => t.day)).toEqual(["2026-06-11", "2026-06-12", "2026-06-13"]);
    expect(timeline.map((t) => t.rank)).toEqual([1, 2, 1]);
    expect(timeline.map((t) => t.cumulativePoints)).toEqual([7, 7, 20]);
    expect(timeline.map((t) => t.pointsThatDay)).toEqual([7, 0, 13]);
    expect(timeline.map((t) => t.matchesThatDay)).toEqual([1, 0, 1]);
  });

  it("delta: dia 1 = 0, desceu = negativo, subiu = positivo", () => {
    const { timeline } = buildRaioXTimeline({
      userId: "a", profiles: [profile("a"), profile("b")], scores: base,
    });
    expect(timeline.map((t) => t.delta)).toEqual([0, -1, 1]);
  });

  it("highlights: currentRank, bestRank(+dia), biggestClimb(+dia), totais", () => {
    const { highlights } = buildRaioXTimeline({
      userId: "a", profiles: [profile("a"), profile("b")], scores: base,
    });
    expect(highlights.currentRank).toBe(1);
    expect(highlights.totalPlayers).toBe(2);
    expect(highlights.bestRank).toBe(1);
    expect(highlights.bestRankDay).toBe("2026-06-11"); // primeira ocorrência
    expect(highlights.biggestClimb).toBe(1);
    expect(highlights.biggestClimbDay).toBe("2026-06-13");
    expect(highlights.totalPoints).toBe(20);
    expect(highlights.exactsTotal).toBe(2);
  });

  it("invariantes: último rank = currentRank; bestRank = min; totalPoints = última soma", () => {
    const { timeline, highlights } = buildRaioXTimeline({
      userId: "a", profiles: [profile("a"), profile("b")], scores: base,
    });
    const last = timeline[timeline.length - 1];
    expect(last.rank).toBe(highlights.currentRank);
    expect(highlights.bestRank).toBe(Math.min(...timeline.map((t) => t.rank)));
    expect(highlights.totalPoints).toBe(last.cumulativePoints);
  });

  it("hasData=false quando o usuário não somou pontos (mesmo com outros pontuando)", () => {
    const r = buildRaioXTimeline({
      userId: "c", profiles: [profile("a"), profile("b"), profile("c")], scores: base,
    });
    expect(r.hasData).toBe(false);
    expect(r.highlights.totalPoints).toBe(0);
  });

  it("hasData=false e timeline vazia quando não há scores", () => {
    const r = buildRaioXTimeline({
      userId: "a", profiles: [profile("a")], scores: [],
    });
    expect(r.hasData).toBe(false);
    expect(r.timeline).toEqual([]);
  });

  it("biggestClimbDay = null quando o usuário nunca subiu", () => {
    // a só cai: 11/06 #1, depois b passa e fica na frente
    const scores: RaioXScore[] = [
      sc("a", 7, "exact", "group", "2026-06-11"),
      sc("b", 34, "exact", "final", "2026-06-12"),
    ];
    const { highlights } = buildRaioXTimeline({
      userId: "a", profiles: [profile("a"), profile("b")], scores,
    });
    expect(highlights.biggestClimb).toBe(0);
    expect(highlights.biggestClimbDay).toBeNull();
  });

  it("empates de rank usam os critérios do ranking-core (desempate por exacts)", () => {
    // a e b com 7 pontos; a por placar exato, b por winner+goals → a na frente
    const scores: RaioXScore[] = [
      sc("a", 7, "exact", "group", "2026-06-11"),
      sc("b", 7, "winner_or_draw", "group", "2026-06-11"),
    ];
    const rA = buildRaioXTimeline({ userId: "a", profiles: [profile("a"), profile("b")], scores });
    const rB = buildRaioXTimeline({ userId: "b", profiles: [profile("a"), profile("b")], scores });
    expect(rA.highlights.currentRank).toBe(1);
    expect(rB.highlights.currentRank).toBe(2);
  });

  it("score órfão (user fora de profiles) é ignorado", () => {
    const scores: RaioXScore[] = [
      sc("a", 7, "exact", "group", "2026-06-11"),
      sc("ghost", 99, "exact", "final", "2026-06-11"),
    ];
    const r = buildRaioXTimeline({ userId: "a", profiles: [profile("a")], scores });
    expect(r.highlights.currentRank).toBe(1);
    expect(r.highlights.totalPoints).toBe(7);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/scoring/__tests__/raio-x-core.test.ts`
Expected: FAIL (módulo `raio-x-core` não existe).

- [ ] **Step 3: Implementar o core**

Criar `src/lib/scoring/raio-x-core.ts`:

```ts
import type { Stage } from "@/lib/types/match";
import type { Tier } from "@/lib/scoring";
import {
  applyScoreToEntry,
  assignRanks,
  compareForRanking,
  type ProfileRow,
  type RankingEntry,
} from "./ranking-core";

export type RaioXScore = {
  user_id: string;
  points: number;
  tier: Tier;
  stage: Stage;
  day: string; // YYYY-MM-DD (dia São Paulo)
};

export type TimelinePoint = {
  day: string;
  rank: number;
  cumulativePoints: number;
  pointsThatDay: number;   // pontos do usuário nesse dia
  matchesThatDay: number;  // qtd de scores DO USUÁRIO nesse dia
  delta: number;           // rank do dia anterior - rank do dia (dia 1 = 0)
};

export type RaioXHighlights = {
  currentRank: number;
  totalPlayers: number;
  bestRank: number;
  bestRankDay: string;
  biggestClimb: number;
  biggestClimbDay: string | null;
  totalPoints: number;
  exactsTotal: number;
};

export type RaioXResult = {
  timeline: TimelinePoint[];
  highlights: RaioXHighlights;
  hasData: boolean;
};

function initEntry(p: ProfileRow): RankingEntry {
  return {
    user_id: p.id,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    paid: p.paid,
    total_points: 0,
    exacts_total: 0,
    exacts_knockout: 0,
    winner_or_draw_total: 0,
    final_points: 0,
    semi_third_final_points: 0,
  };
}

export function buildRaioXTimeline(input: {
  userId: string;
  profiles: ProfileRow[];
  scores: RaioXScore[];
}): RaioXResult {
  const { userId, profiles, scores } = input;
  const totalPlayers = profiles.length;

  // Estado acumulado (mutado incrementalmente a cada dia).
  const entries = new Map<string, RankingEntry>();
  for (const p of profiles) entries.set(p.id, initEntry(p));

  // Agrupa scores por dia.
  const byDay = new Map<string, RaioXScore[]>();
  for (const s of scores) {
    const arr = byDay.get(s.day);
    if (arr) arr.push(s);
    else byDay.set(s.day, [s]);
  }
  const days = [...byDay.keys()].sort(); // string sort funciona p/ YYYY-MM-DD

  const timeline: TimelinePoint[] = [];
  let prevRank: number | null = null;

  for (const day of days) {
    let pointsThatDay = 0;
    let matchesThatDay = 0;
    for (const s of byDay.get(day)!) {
      const entry = entries.get(s.user_id);
      if (!entry) continue; // score órfão
      applyScoreToEntry(entry, { points: s.points, tier: s.tier, stage: s.stage });
      if (s.user_id === userId) {
        pointsThatDay += s.points;
        matchesThatDay += 1;
      }
    }

    const ranked = assignRanks([...entries.values()].sort(compareForRanking));
    const me = ranked.find((r) => r.user_id === userId);
    const rank = me ? me.rank : totalPlayers;
    const cumulativePoints = me ? me.total_points : 0;
    const delta = prevRank === null ? 0 : prevRank - rank;

    timeline.push({ day, rank, cumulativePoints, pointsThatDay, matchesThatDay, delta });
    prevRank = rank;
  }

  const myEntry = entries.get(userId);
  const totalPoints = myEntry?.total_points ?? 0;
  const exactsTotal = myEntry?.exacts_total ?? 0;
  const last = timeline[timeline.length - 1];

  // Seed com Infinity para a PRIMEIRA ocorrência do menor rank vencer (o loop só
  // atualiza em melhora estrita). bestRankDay="" só é alcançável com timeline
  // vazia, e nesse caso hasData=false (a página nem lê highlights).
  let bestRank = timeline.length ? Infinity : totalPlayers;
  let bestRankDay = last ? last.day : "";
  let biggestClimb = 0;
  let biggestClimbDay: string | null = null;
  for (const pt of timeline) {
    if (pt.rank < bestRank) {
      bestRank = pt.rank;
      bestRankDay = pt.day;
    }
    if (pt.delta > biggestClimb) {
      biggestClimb = pt.delta;
      biggestClimbDay = pt.day;
    }
  }

  return {
    timeline,
    highlights: {
      currentRank: last ? last.rank : totalPlayers,
      totalPlayers,
      bestRank,
      bestRankDay,
      biggestClimb,
      biggestClimbDay,
      totalPoints,
      exactsTotal,
    },
    hasData: totalPoints > 0,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/scoring/__tests__/raio-x-core.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/raio-x-core.ts src/lib/scoring/__tests__/raio-x-core.test.ts
git commit -m "feat(scoring): buildRaioXTimeline reconstroi rank/pontos por dia"
```

---

## Task 3: Query server-only `loadRaioX`

Espelha `loadRanking` (`src/lib/scoring/ranking.ts`), acrescentando `kickoff_at` ao join e mapeando para `RaioXScore` via `saoPauloDay`. Sem teste unitário (depende de Supabase) — validação por typecheck/build.

**Files:**
- Create: `src/lib/scoring/raio-x.ts`

- [ ] **Step 1: Implementar**

Criar `src/lib/scoring/raio-x.ts`:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paginateAll } from "@/lib/supabase/paginate";
import { saoPauloDay } from "@/lib/dates/sao-paulo-day";
import { buildRaioXTimeline, type RaioXResult, type RaioXScore } from "./raio-x-core";
import type { ProfileRow } from "./ranking-core";
import type { Tier } from "@/lib/scoring";
import type { Stage } from "@/lib/types/match";

type ScoreJoinRow = {
  user_id: string;
  points: number;
  tier: string;
  matches:
    | { stage: string; kickoff_at: string }
    | { stage: string; kickoff_at: string }[];
};

export async function loadRaioX(userId: string): Promise<RaioXResult> {
  const supabase = await createClient();

  const [profilesQ, scoreRows] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url, paid"),
    paginateAll<ScoreJoinRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("prediction_scores")
        .select("user_id, points, tier, matches!inner(stage, kickoff_at)")
        .order("prediction_id", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as unknown as ScoreJoinRow[];
    }),
  ]);

  if (profilesQ.error) throw profilesQ.error;

  const profiles = (profilesQ.data ?? []) as ProfileRow[];
  const scores: RaioXScore[] = scoreRows.map((r) => {
    const m = Array.isArray(r.matches) ? r.matches[0] : r.matches;
    return {
      user_id: r.user_id,
      points: r.points,
      tier: r.tier as Tier,
      stage: m.stage as Stage,
      day: saoPauloDay(m.kickoff_at),
    };
  });

  return buildRaioXTimeline({ userId, profiles, scores });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring/raio-x.ts
git commit -m "feat(scoring): loadRaioX carrega scores e delega ao core"
```

---

## Task 4: Instalar recharts

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Instalar a v3 (compatível com React 19)**

Run: `npm install recharts@^3`
Expected: instala recharts 3.x; sem erro de peer dependency com React 19.

- [ ] **Step 2: Conferir a versão**

Run: `npm ls recharts`
Expected: `recharts@3.x.x`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): adiciona recharts para o grafico do raio-x"
```

> **Troubleshooting (só se o build/dev quebrar com erro de módulo do recharts):** adicionar `transpilePackages: ["recharts"]` ao `next.config.ts`. Não fazer isso preventivamente.

---

## Task 5: `VariationArrow` compartilhado + refatorar `prediction-row`

Extrai a seta ↑/↓ (hoje inline em `prediction-row.tsx`) para um componente reutilizável. Presentacional puro (sem hooks) → serve tanto em árvore server quanto client.

**Files:**
- Create: `src/components/variation-arrow.tsx`
- Modify: `src/app/(authenticated)/partidas/[matchId]/_components/prediction-row.tsx`

- [ ] **Step 1: Criar o componente**

Criar `src/components/variation-arrow.tsx`:

```tsx
import { ArrowDown, ArrowUp } from "lucide-react";

/** Seta de variação de posição. delta > 0 = subiu, < 0 = desceu, 0 = nada. */
export function VariationArrow({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span
        className="inline-flex items-center text-[10px] font-medium text-emerald-600"
        aria-label={`subiu ${delta} posições`}
      >
        <ArrowUp className="size-3" aria-hidden />
        {delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span
        className="inline-flex items-center text-[10px] font-medium text-red-600"
        aria-label={`desceu ${-delta} posições`}
      >
        <ArrowDown className="size-3" aria-hidden />
        {-delta}
      </span>
    );
  }
  return null;
}
```

- [ ] **Step 2: Refatorar `prediction-row.tsx`**

No topo, trocar o import de `ArrowDown, ArrowUp` por:

```tsx
import { VariationArrow } from "@/components/variation-arrow";
```

Substituir o bloco do rank (a `<span className="flex w-12 ...">` com os dois ternários de `sim.delta`) por:

```tsx
      <span className="flex w-12 items-center justify-end gap-0.5 font-semibold tabular-nums text-muted-foreground">
        {sim ? <VariationArrow delta={sim.delta} /> : null}
        <span>{rank}</span>
      </span>
```

Comportamento idêntico: `VariationArrow` retorna `null` para `delta === 0`, como o código atual.

- [ ] **Step 3: Verificar (lint + testes existentes + typecheck)**

Run: `npm run lint && npx tsc --noEmit && npx vitest run src/lib/scoring/__tests__/simulate.test.ts`
Expected: sem erros; testes de simulação seguem passando (a lógica pura não mudou).

- [ ] **Step 4: Commit**

```bash
git add src/components/variation-arrow.tsx src/app/(authenticated)/partidas/[matchId]/_components/prediction-row.tsx
git commit -m "refactor(ui): extrai VariationArrow compartilhado"
```

---

## Task 6: Ilha do gráfico `RankTimelineChart` (recharts)

Client Component. Eixo Y invertido (#1 no topo), domínio na faixa observada com folga, linha linear, tooltip custom, cores por token. Guard de `mounted` para evitar mismatch de SSR e layout shift.

**Files:**
- Create: `src/app/(authenticated)/raio-x/_components/rank-timeline-chart.tsx`

- [ ] **Step 1: Implementar**

Criar `src/app/(authenticated)/raio-x/_components/rank-timeline-chart.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDayDdMm } from "@/lib/dates/sao-paulo-day";
import type { TimelinePoint } from "@/lib/scoring/raio-x-core";

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TimelinePoint }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <div className="font-semibold">{formatDayDdMm(p.day)}</div>
      <div>Posição: #{p.rank}</div>
      <div>Pontos no dia: {p.pointsThatDay}</div>
      <div>Total: {p.cumulativePoints}</div>
      {p.delta !== 0 && (
        <div className={p.delta > 0 ? "text-emerald-600" : "text-red-600"}>
          {p.delta > 0 ? `↑ ${p.delta}` : `↓ ${-p.delta}`} posições
        </div>
      )}
    </div>
  );
}

export function RankTimelineChart({ timeline }: { timeline: TimelinePoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const ranks = timeline.map((t) => t.rank);
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);
  const domain: [number, number] = [Math.max(1, minRank - 1), maxRank + 1];

  return (
    <div
      className="h-[300px] w-full"
      role="img"
      aria-label="Gráfico da sua posição ao longo da Copa (a tabela abaixo traz os mesmos dados)"
    >
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeline} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={formatDayDdMm}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              minTickGap={16}
              tickMargin={8}
            />
            <YAxis
              reversed
              domain={domain}
              allowDecimals={false}
              width={32}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="linear"
              dataKey="rank"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full animate-pulse rounded-lg bg-muted" />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(authenticated)/raio-x/_components/rank-timeline-chart.tsx
git commit -m "feat(raio-x): grafico de posicao ao longo do tempo (recharts)"
```

---

## Task 7: `HighlightCards`

Server Component. Grid de 5 cards no estilo do `SuaPosicaoCard`.

**Files:**
- Create: `src/app/(authenticated)/raio-x/_components/highlight-cards.tsx`

- [ ] **Step 1: Implementar**

Criar `src/app/(authenticated)/raio-x/_components/highlight-cards.tsx`:

```tsx
import { ArrowUp, Crosshair, Star, Target, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDayDdMm } from "@/lib/dates/sao-paulo-day";
import type { RaioXHighlights } from "@/lib/scoring/raio-x-core";

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="font-heading text-3xl tabular-nums leading-none">{value}</span>
      </CardContent>
    </Card>
  );
}

export function HighlightCards({ highlights: h }: { highlights: RaioXHighlights }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat
        icon={<Trophy className="size-4 text-primary" aria-hidden />}
        value={`#${h.currentRank}`}
        label={`Posição atual (de ${h.totalPlayers})`}
      />
      <Stat
        icon={<Star className="size-4 text-primary" aria-hidden />}
        value={`#${h.bestRank}`}
        label={`Melhor posição · ${formatDayDdMm(h.bestRankDay)}`}
      />
      <Stat
        icon={<ArrowUp className="size-4 text-emerald-600" aria-hidden />}
        value={h.biggestClimbDay ? `+${h.biggestClimb}` : "—"}
        label={h.biggestClimbDay ? `Maior subida · ${formatDayDdMm(h.biggestClimbDay)}` : "Maior subida"}
      />
      <Stat
        icon={<Crosshair className="size-4 text-primary" aria-hidden />}
        value={String(h.totalPoints)}
        label="Total de pontos"
      />
      <Stat
        icon={<Target className="size-4 text-primary" aria-hidden />}
        value={String(h.exactsTotal)}
        label="Na mosca"
      />
    </div>
  );
}
```

> Nota: confirmar que os ícones `Crosshair` e `Star` existem no `lucide-react` instalado (`import { Crosshair, Star } from "lucide-react"`). Se algum não existir nesta versão, trocar por um equivalente presente (ex.: `Target`/`Award`). O typecheck do Step 2 pega isso.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(authenticated)/raio-x/_components/highlight-cards.tsx
git commit -m "feat(raio-x): cards de destaque"
```

---

## Task 8: `DailyTable`

Server Component. Tabela dia a dia, mais recente no topo, com `VariationArrow`.

**Files:**
- Create: `src/app/(authenticated)/raio-x/_components/daily-table.tsx`

- [ ] **Step 1: Implementar**

Criar `src/app/(authenticated)/raio-x/_components/daily-table.tsx`:

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VariationArrow } from "@/components/variation-arrow";
import { formatDayDdMm } from "@/lib/dates/sao-paulo-day";
import type { TimelinePoint } from "@/lib/scoring/raio-x-core";

export function DailyTable({ timeline }: { timeline: TimelinePoint[] }) {
  const rows = [...timeline].reverse(); // mais recente no topo

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dia</TableHead>
          <TableHead className="text-right">Jogos</TableHead>
          <TableHead className="text-right">Pts dia</TableHead>
          <TableHead className="text-right">Posição</TableHead>
          <TableHead className="w-14 text-right">Var.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.day}>
            <TableCell className="font-medium">{formatDayDdMm(r.day)}</TableCell>
            <TableCell className="text-right tabular-nums">{r.matchesThatDay}</TableCell>
            <TableCell className="text-right tabular-nums">{r.pointsThatDay}</TableCell>
            <TableCell className="text-right tabular-nums font-semibold">#{r.rank}</TableCell>
            <TableCell className="text-right">
              <span className="inline-flex justify-end">
                <VariationArrow delta={r.delta} />
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(authenticated)/raio-x/_components/daily-table.tsx
git commit -m "feat(raio-x): tabela dia a dia"
```

---

## Task 9: `RaioXEmpty`

Estado vazio (sem pontos do usuário / pré-Copa).

**Files:**
- Create: `src/app/(authenticated)/raio-x/_components/raio-x-empty.tsx`

- [ ] **Step 1: Implementar**

Criar `src/app/(authenticated)/raio-x/_components/raio-x-empty.tsx`:

```tsx
import { LineChart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function RaioXEmpty() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <LineChart className="size-8 text-muted-foreground" aria-hidden />
        <p className="max-w-sm text-sm text-muted-foreground">
          Você ainda não pontuou. Seu raio-x aparece assim que você somar os
          primeiros pontos.
        </p>
      </CardContent>
    </Card>
  );
}
```

> Nota: se o ícone `LineChart` não existir nesta versão do `lucide-react`, trocar por `TrendingUp` (o typecheck pega).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(authenticated)/raio-x/_components/raio-x-empty.tsx
git commit -m "feat(raio-x): estado vazio"
```

---

## Task 10: Página `/raio-x`

RSC que amarra tudo.

**Files:**
- Create: `src/app/(authenticated)/raio-x/page.tsx`

- [ ] **Step 1: Implementar**

Criar `src/app/(authenticated)/raio-x/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadRaioX } from "@/lib/scoring/raio-x";
import { HighlightCards } from "./_components/highlight-cards";
import { RankTimelineChart } from "./_components/rank-timeline-chart";
import { DailyTable } from "./_components/daily-table";
import { RaioXEmpty } from "./_components/raio-x-empty";

export default async function RaioXPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const data = await loadRaioX(user.id);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Bolão Copa 2026
        </p>
        <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
          Raio-X
        </h1>
        <p className="text-muted-foreground">
          Sua trajetória de posição e pontos ao longo da Copa.
        </p>
      </header>

      {data.hasData ? (
        <>
          <HighlightCards highlights={data.highlights} />
          <RankTimelineChart timeline={data.timeline} />
          <DailyTable timeline={data.timeline} />
        </>
      ) : (
        <RaioXEmpty />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(authenticated)/raio-x/page.tsx
git commit -m "feat(raio-x): pagina /raio-x"
```

---

## Task 11: Navegação (menu + link na home)

**Files:**
- Modify: `src/app/(authenticated)/_components/auth-header.tsx`
- Modify: `src/app/(authenticated)/inicio/_components/sua-posicao-card.tsx`

- [ ] **Step 1: Adicionar item ao menu**

Em `src/app/(authenticated)/_components/auth-header.tsx`, no array `NAV`, inserir o Raio-X (entre Ranking e Regulamento):

```tsx
const NAV = [
  { href: "/inicio", label: "Início" },
  { href: "/palpites", label: "Palpites" },
  { href: "/classificacao", label: "Ranking" },
  { href: "/raio-x", label: "Raio-X" },
  { href: "/regulamento", label: "Regulamento" },
];
```

- [ ] **Step 2: Link no card "Sua posição"**

Em `src/app/(authenticated)/inicio/_components/sua-posicao-card.tsx`:

Adicionar o import no topo:

```tsx
import Link from "next/link";
```

Ao fim do `<CardContent>` (após o bloco condicional `hasPalpitado ? ... : ...`), adicionar:

```tsx
        <Link
          href="/raio-x"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ver meu raio-x →
        </Link>
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/(authenticated)/_components/auth-header.tsx src/app/(authenticated)/inicio/_components/sua-posicao-card.tsx
git commit -m "feat(raio-x): entrada no menu e link na home"
```

---

## Task 12: Verificação final

- [ ] **Step 1: Suite completa + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: todos os testes passam; lint limpo; build conclui sem erros.

- [ ] **Step 2: Checagem manual no dev server**

Run: `npm run dev` e abrir `http://localhost:3000/raio-x` logado.
Verificar:
- Gráfico renderiza com #1 no topo (eixo invertido) e linha da posição.
- Tooltip mostra dia · posição · pontos do dia · total · variação.
- Cards de destaque batem com o `SuaPosicaoCard` (mesma posição atual e "na mosca").
- Tabela dia a dia com o mais recente no topo e setas de variação corretas.
- Menu tem "Raio-X" (desktop e mobile) e o card "Sua posição" tem o link.
- Usuário sem pontos → estado vazio (testar com uma conta que ainda não pontuou, se houver).
- Alternar tema claro/escuro: cores do gráfico acompanham.

- [ ] **Step 3: Commit final (se houver ajustes da checagem manual)**

```bash
git add -A
git commit -m "fix(raio-x): ajustes da verificacao manual"
```

---

## Notas de implementação

- **DRY:** o rank diário reusa `applyScoreToEntry`/`compareForRanking`/`assignRanks` — nunca diverge da Classificação. A seta de variação é o `VariationArrow` compartilhado, e o formato `dd/mm` é o `formatDayDdMm` (único, no módulo de datas).
- **Sem teste de componente/recharts:** segue o padrão do repo — a lógica testável mora no core puro (`raio-x-core.ts`). Componentes são validados por typecheck/lint/build + checagem manual.
- **Cores por token** (`var(--chart-1)`, `var(--border)`, `var(--muted-foreground)`): funcionam em dark/light sem hardcode (tokens são oklch cru em `globals.css`).
- **`hasData = totalPoints > 0`** espelha o `hasPalpitado` do `SuaPosicaoCard`; cobre pré-Copa e usuário sem pontos com um único caminho.
- **Eixo X = dias presentes nos scores** (dia São Paulo do `kickoff_at`), ordenados como string `YYYY-MM-DD`.
```
