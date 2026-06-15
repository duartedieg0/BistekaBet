# Detalhes de palpites por partida — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que qualquer usuário visualize todos os palpites de uma partida quando ela já começou, em `/partidas/[matchId]`, com busca por nome e ordenação pelo ranking geral.

**Architecture:** Server Component em `/partidas/[matchId]` busca a partida, palpites e pontuações em paralelo e reusa `loadRanking()` para garantir elegibilidade/ordenação consistentes com `/classificacao`. Um Client Component faz a busca por nome em memória. O botão de acesso é adicionado ao `MatchPredictionCard` existente — herdado automaticamente por `/inicio`.

**Tech Stack:** Next.js (App Router), React Server Components, Supabase (`@/lib/supabase/server`), Vitest, TailwindCSS, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-06-15-detalhes-palpites-partida-design.md`

---

## File Structure

**Create:**

- `src/app/(authenticated)/partidas/[matchId]/page.tsx` — Server Component (busca + render).
- `src/app/(authenticated)/partidas/[matchId]/loading.tsx` — skeleton.
- `src/app/(authenticated)/partidas/[matchId]/_components/match-header.tsx` — cabeçalho com times, data e resultado oficial.
- `src/app/(authenticated)/partidas/[matchId]/_components/predictions-list.tsx` — Client Component com busca e seções.
- `src/app/(authenticated)/partidas/[matchId]/_components/prediction-row.tsx` — apresentacional.
- `src/app/(authenticated)/partidas/[matchId]/_components/no-prediction-section.tsx` — `<details>` colapsável.
- `src/app/(authenticated)/partidas/[matchId]/_lib/join-prediction-rows.ts` — função pura que monta as linhas a partir de ranking + palpites + scores.
- `src/app/(authenticated)/partidas/[matchId]/_lib/search-filter.ts` — função pura de filtro por nome.
- `src/app/(authenticated)/partidas/[matchId]/_lib/get-match-predictions.ts` — server-only loader.
- `src/app/(authenticated)/partidas/[matchId]/_lib/__tests__/join-prediction-rows.test.ts`
- `src/app/(authenticated)/partidas/[matchId]/_lib/__tests__/search-filter.test.ts`

**Modify:**

- `src/app/(authenticated)/palpites/_components/match-prediction-card.tsx` — adicionar link "Ver palpites" no header quando `isClosed`.

---

## Task 1: Filtro de busca por nome (função pura, TDD)

**Files:**
- Create: `src/app/(authenticated)/partidas/[matchId]/_lib/search-filter.ts`
- Test: `src/app/(authenticated)/partidas/[matchId]/_lib/__tests__/search-filter.test.ts`

- [ ] **Step 1: Criar o teste falhando**

```ts
import { describe, expect, it } from "vitest";
import { filterByName } from "../search-filter";

type Row = { display_name: string };

const rows: Row[] = [
  { display_name: "Ana Lúcia" },
  { display_name: "Bruno" },
  { display_name: "João Pedro" },
  { display_name: "Renata Café" },
];

describe("filterByName", () => {
  it("retorna a lista íntegra quando a query é vazia", () => {
    expect(filterByName(rows, "").map((r) => r.display_name)).toEqual(
      rows.map((r) => r.display_name),
    );
  });

  it("é case-insensitive", () => {
    expect(filterByName(rows, "bruno").map((r) => r.display_name)).toEqual(["Bruno"]);
  });

  it("é accent-insensitive", () => {
    expect(filterByName(rows, "lucia").map((r) => r.display_name)).toEqual(["Ana Lúcia"]);
    expect(filterByName(rows, "cafe").map((r) => r.display_name)).toEqual(["Renata Café"]);
  });

  it("faz match parcial em qualquer posição", () => {
    expect(filterByName(rows, "pedro").map((r) => r.display_name)).toEqual(["João Pedro"]);
  });

  it("retorna lista vazia quando ninguém bate", () => {
    expect(filterByName(rows, "xyz")).toEqual([]);
  });

  it("ignora espaços nas pontas da query", () => {
    expect(filterByName(rows, "  bruno  ").map((r) => r.display_name)).toEqual(["Bruno"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/\(authenticated\)/partidas/\[matchId\]/_lib/__tests__/search-filter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementar o filtro**

```ts
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function filterByName<T extends { display_name: string }>(
  rows: T[],
  query: string,
): T[] {
  const q = normalize(query.trim());
  if (q === "") return rows;
  return rows.filter((r) => normalize(r.display_name).includes(q));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/app/\(authenticated\)/partidas/\[matchId\]/_lib/__tests__/search-filter.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(authenticated\)/partidas/\[matchId\]/_lib/search-filter.ts \
        src/app/\(authenticated\)/partidas/\[matchId\]/_lib/__tests__/search-filter.test.ts
git commit -m "feat(partidas): filtro de busca por nome para detalhes de palpites"
```

---

## Task 2: Função pura `joinPredictionRows` (TDD)

A função recebe o ranking ordenado, palpites e pontuações da partida e produz `MatchPredictionRow[]`, **preservando a ordem do ranking**.

**Files:**
- Create: `src/app/(authenticated)/partidas/[matchId]/_lib/join-prediction-rows.ts`
- Test: `src/app/(authenticated)/partidas/[matchId]/_lib/__tests__/join-prediction-rows.test.ts`

- [ ] **Step 1: Criar o teste falhando**

```ts
import { describe, expect, it } from "vitest";
import { joinPredictionRows } from "../join-prediction-rows";
import type { RankingRow } from "@/lib/scoring/ranking-core";

function rk(
  user_id: string,
  display_name: string,
  rank: number,
  avatar_url: string | null = null,
): RankingRow {
  return {
    user_id,
    display_name,
    avatar_url,
    paid: true,
    total_points: 0,
    exacts_total: 0,
    exacts_knockout: 0,
    winner_or_draw_total: 0,
    final_points: 0,
    semi_third_final_points: 0,
    rank,
  };
}

describe("joinPredictionRows", () => {
  const ranking = [
    rk("u1", "Ana", 1),
    rk("u2", "Bruno", 2),
    rk("u3", "Carlos", 3),
  ];

  it("preserva ordem do ranking", () => {
    const rows = joinPredictionRows({
      ranking,
      predictions: [],
      scores: [],
    });
    expect(rows.map((r) => r.user_id)).toEqual(["u1", "u2", "u3"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("anexa palpite quando o usuário palpitou", () => {
    const rows = joinPredictionRows({
      ranking,
      predictions: [
        { user_id: "u2", home_score: 2, away_score: 1 },
      ],
      scores: [],
    });
    expect(rows.find((r) => r.user_id === "u2")?.prediction).toEqual({
      home_score: 2,
      away_score: 1,
    });
    expect(rows.find((r) => r.user_id === "u1")?.prediction).toBeNull();
  });

  it("anexa score quando há pontuação para o usuário", () => {
    const rows = joinPredictionRows({
      ranking,
      predictions: [
        { user_id: "u1", home_score: 2, away_score: 1 },
      ],
      scores: [
        { user_id: "u1", points: 5, tier: "exact" },
      ],
    });
    expect(rows.find((r) => r.user_id === "u1")?.score).toEqual({
      points: 5,
      tier: "exact",
    });
    expect(rows.find((r) => r.user_id === "u2")?.score).toBeNull();
  });

  it("quando não há scores, todos têm score null", () => {
    const rows = joinPredictionRows({
      ranking,
      predictions: [
        { user_id: "u1", home_score: 1, away_score: 1 },
        { user_id: "u2", home_score: 0, away_score: 0 },
      ],
      scores: [],
    });
    expect(rows.every((r) => r.score === null)).toBe(true);
  });

  it("ignora palpites/scores de usuários fora do ranking", () => {
    const rows = joinPredictionRows({
      ranking,
      predictions: [
        { user_id: "outsider", home_score: 9, away_score: 9 },
      ],
      scores: [
        { user_id: "outsider", points: 99, tier: "exact" },
      ],
    });
    expect(rows.map((r) => r.user_id)).toEqual(["u1", "u2", "u3"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/\(authenticated\)/partidas/\[matchId\]/_lib/__tests__/join-prediction-rows.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementar a função**

```ts
import type { RankingRow } from "@/lib/scoring/ranking-core";
import type { PredictionScore } from "@/lib/types/prediction";
import type { Tier } from "@/lib/scoring";

export type PredictionLite = {
  user_id: string;
  home_score: number;
  away_score: number;
};

export type ScoreLite = {
  user_id: string;
  points: number;
  tier: Tier;
};

export type MatchPredictionRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  rank: number;
  prediction: { home_score: number; away_score: number } | null;
  score: PredictionScore | null;
};

export function joinPredictionRows(input: {
  ranking: RankingRow[];
  predictions: PredictionLite[];
  scores: ScoreLite[];
}): MatchPredictionRow[] {
  const predByUser = new Map<string, PredictionLite>();
  for (const p of input.predictions) predByUser.set(p.user_id, p);

  const scoreByUser = new Map<string, PredictionScore>();
  for (const s of input.scores) {
    scoreByUser.set(s.user_id, { points: s.points, tier: s.tier });
  }

  return input.ranking.map((r) => {
    const pred = predByUser.get(r.user_id);
    return {
      user_id: r.user_id,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      rank: r.rank,
      prediction: pred ? { home_score: pred.home_score, away_score: pred.away_score } : null,
      score: scoreByUser.get(r.user_id) ?? null,
    };
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/app/\(authenticated\)/partidas/\[matchId\]/_lib/__tests__/join-prediction-rows.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(authenticated\)/partidas/\[matchId\]/_lib/join-prediction-rows.ts \
        src/app/\(authenticated\)/partidas/\[matchId\]/_lib/__tests__/join-prediction-rows.test.ts
git commit -m "feat(partidas): join puro entre ranking, palpites e pontuações"
```

---

## Task 3: Loader server-only `getMatchPredictions`

Compõe `loadRanking()` + queries de Supabase + `joinPredictionRows`. Não tem teste unitário direto — é orquestração de I/O — mas é pequeno e a lógica pura já está coberta.

**Files:**
- Create: `src/app/(authenticated)/partidas/[matchId]/_lib/get-match-predictions.ts`

- [ ] **Step 1: Implementar o loader**

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadRanking } from "@/lib/scoring/ranking";
import type { Match, Team } from "@/lib/types/match";
import {
  joinPredictionRows,
  type MatchPredictionRow,
  type PredictionLite,
  type ScoreLite,
} from "./join-prediction-rows";

export type MatchWithTeams = Match & {
  home_team: Pick<Team, "id" | "code" | "name" | "flag_url"> | null;
  away_team: Pick<Team, "id" | "code" | "name" | "flag_url"> | null;
};

export type MatchDetailData = {
  match: MatchWithTeams;
  predictions: MatchPredictionRow[];
};

export async function getMatchPredictions(
  matchId: string,
): Promise<MatchDetailData | null> {
  const supabase = await createClient();

  const matchQ = supabase
    .from("matches")
    .select(
      `*, home_team:home_team_id(id,code,name,flag_url), away_team:away_team_id(id,code,name,flag_url)`,
    )
    .eq("id", matchId)
    .maybeSingle();

  const predictionsQ = supabase
    .from("predictions")
    .select("user_id, home_score, away_score")
    .eq("match_id", matchId);

  const scoresQ = supabase
    .from("prediction_scores")
    .select("user_id, points, tier")
    .eq("match_id", matchId);

  const [matchRes, predsRes, scoresRes, ranking] = await Promise.all([
    matchQ,
    predictionsQ,
    scoresQ,
    loadRanking(),
  ]);

  if (matchRes.error) throw matchRes.error;
  if (predsRes.error) throw predsRes.error;
  if (scoresRes.error) throw scoresRes.error;

  if (!matchRes.data) return null;

  return {
    match: matchRes.data as MatchWithTeams,
    predictions: joinPredictionRows({
      ranking,
      predictions: (predsRes.data ?? []) as PredictionLite[],
      scores: (scoresRes.data ?? []) as ScoreLite[],
    }),
  };
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros novos no arquivo criado.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authenticated\)/partidas/\[matchId\]/_lib/get-match-predictions.ts
git commit -m "feat(partidas): loader server-only para detalhes de palpites"
```

---

## Task 4: Componente `PredictionRow`

**Files:**
- Create: `src/app/(authenticated)/partidas/[matchId]/_components/prediction-row.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { getInitials } from "@/app/(authenticated)/_components/avatar-fallback";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { MatchPredictionRow } from "../_lib/join-prediction-rows";

type Props = {
  row: MatchPredictionRow;
  showPoints: boolean;
};

export function PredictionRow({ row, showPoints }: Props) {
  const hasPrediction = row.prediction !== null;
  return (
    <li className="flex items-center gap-3 border-b px-2 py-2 last:border-b-0">
      <span className="w-8 text-right font-semibold tabular-nums text-muted-foreground">
        {row.rank}
      </span>
      <Avatar className="size-7 shrink-0">
        {row.avatar_url ? <AvatarImage src={row.avatar_url} alt="" /> : null}
        <AvatarFallback className="text-xs">
          {getInitials(row.display_name)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-sm" title={row.display_name}>
        {row.display_name}
      </span>
      <span
        className={cn(
          "w-16 text-right tabular-nums font-medium",
          !hasPrediction && "text-muted-foreground italic",
        )}
      >
        {hasPrediction
          ? `${row.prediction!.home_score} × ${row.prediction!.away_score}`
          : "—"}
      </span>
      {showPoints ? (
        <span
          className="w-12 text-right tabular-nums text-sm"
          aria-label={`${row.score?.points ?? 0} pontos`}
        >
          {row.score?.points ?? 0}
        </span>
      ) : null}
    </li>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(authenticated\)/partidas/\[matchId\]/_components/prediction-row.tsx
git commit -m "feat(partidas): linha de palpite individual"
```

---

## Task 5: Componente `NoPredictionSection`

**Files:**
- Create: `src/app/(authenticated)/partidas/[matchId]/_components/no-prediction-section.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { PredictionRow } from "./prediction-row";
import type { MatchPredictionRow } from "../_lib/join-prediction-rows";

export function NoPredictionSection({ rows }: { rows: MatchPredictionRow[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="rounded-md border bg-muted/30">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-muted-foreground">
        Sem palpite ({rows.length})
      </summary>
      <ul className="px-1 pb-2">
        {rows.map((row) => (
          <PredictionRow key={row.user_id} row={row} showPoints={false} />
        ))}
      </ul>
    </details>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(authenticated\)/partidas/\[matchId\]/_components/no-prediction-section.tsx
git commit -m "feat(partidas): seção colapsável 'Sem palpite'"
```

---

## Task 6: Client Component `PredictionsList` (busca + agrupamento)

**Files:**
- Create: `src/app/(authenticated)/partidas/[matchId]/_components/predictions-list.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PredictionRow } from "./prediction-row";
import { NoPredictionSection } from "./no-prediction-section";
import { filterByName } from "../_lib/search-filter";
import type { MatchPredictionRow } from "../_lib/join-prediction-rows";

type Props = {
  rows: MatchPredictionRow[];
  showPoints: boolean;
};

export function PredictionsList({ rows, showPoints }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => filterByName(rows, query), [rows, query]);
  const withPrediction = filtered.filter((r) => r.prediction !== null);
  const withoutPrediction = filtered.filter((r) => r.prediction === null);

  const noResults = query.trim() !== "" && filtered.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 -mx-6 bg-background px-6 py-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome…"
            aria-label="Buscar usuário por nome"
            className="pl-9"
          />
        </div>
      </div>

      {noResults ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum usuário encontrado.
        </p>
      ) : (
        <>
          {withPrediction.length > 0 ? (
            <ul className="rounded-md border">
              {withPrediction.map((row) => (
                <PredictionRow key={row.user_id} row={row} showPoints={showPoints} />
              ))}
            </ul>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Ninguém palpitou neste jogo.
            </p>
          )}

          <NoPredictionSection rows={withoutPrediction} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(authenticated\)/partidas/\[matchId\]/_components/predictions-list.tsx
git commit -m "feat(partidas): lista filtrável de palpites"
```

---

## Task 7: Componente `MatchHeader`

**Files:**
- Create: `src/app/(authenticated)/partidas/[matchId]/_components/match-header.tsx`

- [ ] **Step 1: Implementar**

```tsx
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { flagSrc } from "@/lib/flags";
import { formatKickoff } from "@/lib/dates/sao-paulo-day";
import { STAGE_LABELS } from "@/lib/types/match";
import type { MatchWithTeams } from "../_lib/get-match-predictions";

function statusLabel(match: MatchWithTeams): string {
  if (match.status === "cancelled") return "Partida cancelada";
  if (match.status === "postponed") return "Partida adiada";
  if (match.home_score === null || match.away_score === null) {
    return "Aguardando resultado oficial";
  }
  return "Resultado oficial";
}

function TeamBlock({
  name,
  code,
  align,
}: {
  name: string;
  code: string;
  align: "start" | "end";
}) {
  const flag = flagSrc(code, 80);
  return (
    <div
      className={`flex items-center gap-3 ${align === "end" ? "justify-end" : "justify-start"}`}
    >
      {align === "start" && flag ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flag} alt="" width={28} height={21} className="rounded-sm" />
      ) : null}
      <span className="text-base font-semibold sm:text-lg">{name}</span>
      {align === "end" && flag ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flag} alt="" width={28} height={21} className="rounded-sm" />
      ) : null}
    </div>
  );
}

export function MatchHeader({ match }: { match: MatchWithTeams }) {
  const home = match.home_team;
  const away = match.away_team;
  const hasResult =
    match.home_score !== null &&
    match.away_score !== null &&
    match.status !== "cancelled" &&
    match.status !== "postponed";

  return (
    <header className="flex flex-col gap-4 pb-6">
      <Link
        href="/palpites"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Voltar
      </Link>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {STAGE_LABELS[match.stage]}
        </p>
        <p className="text-sm text-muted-foreground">{formatKickoff(match.kickoff_at)}</p>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-md border bg-card p-4">
        <TeamBlock name={home?.name ?? "A definir"} code={home?.code ?? "TBD"} align="end" />
        {hasResult ? (
          <span className="font-heading text-2xl tabular-nums">
            {match.home_score} <span className="opacity-50">×</span> {match.away_score}
          </span>
        ) : (
          <span className="font-heading text-2xl text-muted-foreground">×</span>
        )}
        <TeamBlock name={away?.name ?? "A definir"} code={away?.code ?? "TBD"} align="start" />
      </div>

      <Badge variant="secondary" className="self-start">
        {statusLabel(match)}
      </Badge>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(authenticated\)/partidas/\[matchId\]/_components/match-header.tsx
git commit -m "feat(partidas): cabeçalho da página de detalhes"
```

---

## Task 8: Página `/partidas/[matchId]/page.tsx` + `loading.tsx`

**Files:**
- Create: `src/app/(authenticated)/partidas/[matchId]/page.tsx`
- Create: `src/app/(authenticated)/partidas/[matchId]/loading.tsx`

- [ ] **Step 1: Implementar `page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getMatchPredictions } from "./_lib/get-match-predictions";
import { MatchHeader } from "./_components/match-header";
import { PredictionsList } from "./_components/predictions-list";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const data = await getMatchPredictions(matchId);
  if (!data) notFound();

  const { match, predictions } = data;

  if (new Date(match.kickoff_at).getTime() > Date.now()) {
    notFound();
  }

  const hasResult =
    match.home_score !== null &&
    match.away_score !== null &&
    match.status !== "cancelled" &&
    match.status !== "postponed";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <MatchHeader match={match} />
      <PredictionsList rows={predictions} showPoints={hasResult} />
    </main>
  );
}
```

- [ ] **Step 2: Implementar `loading.tsx`**

```tsx
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex flex-col gap-4 pb-6">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Build dev para validar**

Run: `npm run build` (ou `npx tsc --noEmit`)
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/partidas/\[matchId\]/page.tsx \
        src/app/\(authenticated\)/partidas/\[matchId\]/loading.tsx
git commit -m "feat(partidas): página de detalhes /partidas/[matchId]"
```

---

## Task 9: Botão "Ver palpites" no `MatchPredictionCard`

**Files:**
- Modify: `src/app/(authenticated)/palpites/_components/match-prediction-card.tsx`

- [ ] **Step 1: Editar o header do card**

Substituir o bloco que monta `statusBadge` e seu uso no `<CardHeader>` (linhas ~105–120 do arquivo atual) para incluir o link "Ver palpites" quando `isClosed`.

Mudança no topo do arquivo: adicionar imports.

```tsx
import Link from "next/link";
import { Users } from "lucide-react";
```

Substituir o `<CardHeader>` por:

```tsx
<CardHeader className="flex flex-row items-center justify-between gap-2">
  <div className="flex items-center gap-2">
    <span className="text-xs font-medium tabular text-muted-foreground">{kickoffLabel}</span>
    <RescheduledBadge originalKickoff={match.original_kickoff_at} />
  </div>
  <div className="flex items-center gap-2">
    {statusBadge}
    {isClosed ? (
      <Link
        href={`/partidas/${match.id}`}
        aria-label={`Ver palpites de ${homeLabel} contra ${awayLabel}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <Users className="size-3.5" aria-hidden />
        Ver palpites
      </Link>
    ) : null}
  </div>
</CardHeader>
```

Nota: `homeLabel` e `awayLabel` já são calculados mais abaixo no componente — mover essas duas linhas para ANTES do `return`, próximo às outras derivações (`kickoffLabel`), para ficarem disponíveis no header.

- [ ] **Step 2: Validar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Subir dev e testar manualmente**

Run: `npm run dev`
Verificar:
- Card de partida ainda **não iniciada** em `/palpites`: NÃO mostra "Ver palpites".
- Card de partida **já iniciada**: mostra "Ver palpites".
- Clicar leva para `/partidas/<id>` e renderiza a lista.
- Mesmo card em `/inicio`: mesmo comportamento.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/palpites/_components/match-prediction-card.tsx
git commit -m "feat(palpites): link 'Ver palpites' no card de partida iniciada"
```

---

## Task 10: Validação end-to-end manual + suíte

- [ ] **Step 1: Rodar suíte completa**

Run: `npm test`
Expected: todos os testes passando (incluindo os 2 novos arquivos).

- [ ] **Step 2: Checklist manual em `npm run dev`**

- [ ] Acessar `/partidas/<id-de-partida-futura>` direto pela URL → 404.
- [ ] Acessar `/partidas/<id-inexistente>` → 404.
- [ ] Partida com resultado: coluna de pontos visível, ordenada pelo ranking.
- [ ] Partida iniciada sem resultado: status "Aguardando resultado oficial", sem coluna de pontos.
- [ ] Partida cancelada/adiada: status correto, sem coluna de pontos.
- [ ] Busca por nome com acento/sem acento, case mista.
- [ ] Seção "Sem palpite (N)" colapsada por padrão; expandir mostra usuários.
- [ ] Mobile: layout não estoura, header compacto.

- [ ] **Step 3: Commit final (se houve ajustes)**

```bash
git add -A
git commit -m "chore(partidas): ajustes de validação manual"
```

---

## Notas finais

- **Convenções de arquitetura do projeto:** Server Components por padrão; Client Components só para estado de UI (`PredictionsList`). Loaders ficam em `_lib/` com `import "server-only";`.
- **Reuso de `loadRanking`:** garante que "elegibilidade" e ordenação sejam a mesma usada em `/classificacao`. Não duplicar a regra.
- **Sem novos endpoints/server actions:** apenas leitura via Supabase server client.
- **YAGNI:** sem export, sem paginação, sem realtime, sem coluna "avança".
