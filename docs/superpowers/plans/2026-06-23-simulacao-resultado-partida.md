# Simulação de resultado na página da partida — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na página `/partidas/[matchId]`, enquanto a partida aguarda resultado oficial, permitir simular um placar e ver na lista de palpites os pontos da partida (coluna Pts), o total no bolão com a simulação (coluna Total) e a classificação geral recalculada (coluna # reordenada, com seta ↑/↓).

**Architecture:** Recálculo 100% no cliente reutilizando o motor de ranking/pontuação já testado. Um helper puro novo (`applyScoreToEntry`) é extraído de `aggregate()` e compartilhado com uma função pura nova (`simulateMatchRanking`). A página serializa o ranking (embutido em cada linha) e os palpites; ao "Simular", a função pura roda no navegador e a lista reflete o resultado hipotético. Nada é persistido.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript, Vitest, Tailwind v4, base-ui, lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-23-simulacao-resultado-partida-design.md`

---

## File Structure

```
src/lib/scoring/
  ranking-core.ts                 # MODIFICAR: extrair applyScoreToEntry; aggregate passa a usá-lo
  simulate.ts                     # CRIAR: simulateMatchRanking (função pura) + tipo SimulatedRow
  __tests__/
    ranking-core.test.ts          # MODIFICAR: adicionar testes de applyScoreToEntry
    simulate.test.ts              # CRIAR

src/app/(authenticated)/partidas/[matchId]/
  page.tsx                        # MODIFICAR: calcular canSimulate; renderizar MatchSimulator
  _lib/
    join-prediction-rows.ts       # MODIFICAR: embutir entry: RankingRow em cada linha
    __tests__/
      join-prediction-rows.test.ts# MODIFICAR: asserir entry
  _components/
    simulation-controls.tsx       # CRIAR: campos numéricos + Simular/Limpar
    match-simulator.tsx           # CRIAR: Client wrapper, dono do estado, roda a função pura
    predictions-list.tsx          # MODIFICAR: prop simulation; reordenação; colunas Pts/Total no header
    prediction-row.tsx            # MODIFICAR: colunas Pts/Total + seta de variação
    no-prediction-section.tsx     # MODIFICAR: repassar simulation às linhas
```

**Boundaries:**
- `ranking-core.ts` / `simulate.ts`: lógica pura, agnóstica de UI e de rota. Testadas com Vitest.
- `match-simulator.tsx`: única peça que conhece tanto as linhas da rota quanto a função pura — adapta `rows` → entradas da simulação.
- `predictions-list` / `prediction-row` / `no-prediction-section`: apresentacionais; recebem o mapa de simulação pronto.

**Convenção de testes do repo:** apenas lógica pura tem testes unitários (Vitest). Componentes React **não** têm testes; são verificados por `npm run lint` + `npx tsc --noEmit` + checagem manual no dev server.

---

## Task 1: Extrair `applyScoreToEntry` em `ranking-core.ts`

Refator sem mudança de comportamento: extrair o trecho de acumulação por score de `aggregate()` para um helper puro exportado, reutilizável pela simulação. Os testes existentes de `aggregate` garantem a não-regressão.

**Files:**
- Modify: `src/lib/scoring/ranking-core.ts`
- Test: `src/lib/scoring/__tests__/ranking-core.test.ts`

- [ ] **Step 1: Escrever os testes do novo helper (falham — ainda não exportado)**

Adicionar ao final de `src/lib/scoring/__tests__/ranking-core.test.ts`, e incluir `applyScoreToEntry` no import existente do topo (`import { aggregate, compareForRanking, assignRanks, applyScoreToEntry, type ... } from "@/lib/scoring/ranking-core";`):

```ts
describe("applyScoreToEntry", () => {
  it("exact em mata-mata soma pontos, exacts_total, exacts_knockout e winner_or_draw_total", () => {
    const e = baseEntry();
    applyScoreToEntry(e, { points: 13, tier: "exact", stage: "round_of_16" });
    expect(e.total_points).toBe(13);
    expect(e.exacts_total).toBe(1);
    expect(e.exacts_knockout).toBe(1);
    expect(e.winner_or_draw_total).toBe(1);
  });

  it("exact na fase de grupos não conta exacts_knockout", () => {
    const e = baseEntry();
    applyScoreToEntry(e, { points: 7, tier: "exact", stage: "group" });
    expect(e.exacts_total).toBe(1);
    expect(e.exacts_knockout).toBe(0);
  });

  it("miss não incrementa winner_or_draw_total", () => {
    const e = baseEntry();
    applyScoreToEntry(e, { points: 0, tier: "miss", stage: "group" });
    expect(e.winner_or_draw_total).toBe(0);
    expect(e.total_points).toBe(0);
  });

  it("final e semi alimentam final_points e semi_third_final_points", () => {
    const e = baseEntry();
    applyScoreToEntry(e, { points: 34, tier: "exact", stage: "final" });
    expect(e.final_points).toBe(34);
    expect(e.semi_third_final_points).toBe(34);
    applyScoreToEntry(e, { points: 25, tier: "exact", stage: "semi" });
    expect(e.final_points).toBe(34);
    expect(e.semi_third_final_points).toBe(34 + 25);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run src/lib/scoring/__tests__/ranking-core.test.ts`
Expected: FAIL — `applyScoreToEntry is not a function` / erro de import.

- [ ] **Step 3: Implementar o helper e refatorar `aggregate`**

Em `src/lib/scoring/ranking-core.ts`, adicionar o helper exportado logo antes de `aggregate` (reaproveitando as constantes `KNOCKOUT_STAGES` e `SEMI_THIRD_FINAL` já existentes no arquivo):

```ts
export function applyScoreToEntry(
  entry: RankingEntry,
  input: { points: number; tier: Tier; stage: Stage },
): void {
  const { points, tier, stage } = input;
  entry.total_points += points;
  if (tier === "exact") {
    entry.exacts_total += 1;
    if (KNOCKOUT_STAGES.has(stage)) entry.exacts_knockout += 1;
  }
  if (tier !== "miss") entry.winner_or_draw_total += 1;
  if (stage === "final") entry.final_points += points;
  if (SEMI_THIRD_FINAL.has(stage)) entry.semi_third_final_points += points;
}
```

Substituir o corpo do laço `for (const sc of scores)` dentro de `aggregate` por:

```ts
  for (const sc of scores) {
    const entry = init.get(sc.user_id);
    if (!entry) continue;
    applyScoreToEntry(entry, { points: sc.points, tier: sc.tier, stage: sc.stage });
  }
```

(O arquivo já importa `Tier` de `@/lib/scoring` e `Stage` de `@/lib/types/match` — nada novo a importar.)

- [ ] **Step 4: Rodar e confirmar que passam (incl. testes antigos de aggregate)**

Run: `npx vitest run src/lib/scoring/__tests__/ranking-core.test.ts`
Expected: PASS — todos, inclusive os de `aggregate`/`compareForRanking`/`assignRanks` (não-regressão).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/ranking-core.ts src/lib/scoring/__tests__/ranking-core.test.ts
git commit -m "refactor(scoring): extrai applyScoreToEntry de aggregate"
```

---

## Task 2: Função pura `simulateMatchRanking`

**Files:**
- Create: `src/lib/scoring/simulate.ts`
- Test: `src/lib/scoring/__tests__/simulate.test.ts`

- [ ] **Step 1: Escrever os testes (falham — arquivo não existe)**

Criar `src/lib/scoring/__tests__/simulate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { simulateMatchRanking } from "@/lib/scoring/simulate";
import type { RankingRow } from "@/lib/scoring/ranking-core";

const rk = (user_id: string, rank: number, over: Partial<RankingRow> = {}): RankingRow => ({
  user_id,
  display_name: user_id,
  avatar_url: null,
  paid: true,
  total_points: 0,
  exacts_total: 0,
  exacts_knockout: 0,
  winner_or_draw_total: 0,
  final_points: 0,
  semi_third_final_points: 0,
  rank,
  ...over,
});

describe("simulateMatchRanking", () => {
  it("placar exato dá os pontos do estágio e soma ao total", () => {
    const entries = [rk("a", 1, { total_points: 10 }), rk("b", 2, { total_points: 8 })];
    const predictions = new Map([["a", { home: 2, away: 1 }]]);
    const out = simulateMatchRanking({ entries, predictions, result: { home: 2, away: 1 }, stage: "group" });
    expect(out.get("a")!.points).toBe(7); // exact na fase de grupos
    expect(out.get("a")!.tier).toBe("exact");
    expect(out.get("a")!.total).toBe(17);
    expect(out.get("a")!.rank).toBe(1);
    expect(out.get("a")!.delta).toBe(0);
  });

  it("quem não palpitou recebe points null e total inalterado, mas ainda é ranqueado", () => {
    const entries = [rk("a", 1, { total_points: 10 }), rk("b", 2, { total_points: 8 })];
    const predictions = new Map([["a", { home: 0, away: 0 }]]);
    const out = simulateMatchRanking({ entries, predictions, result: { home: 1, away: 0 }, stage: "group" });
    expect(out.get("b")!.points).toBeNull();
    expect(out.get("b")!.tier).toBeNull();
    expect(out.get("b")!.total).toBe(8);
    expect(out.get("b")!.rank).toBe(2);
  });

  it("reordena e calcula delta quando b ultrapassa a", () => {
    const entries = [rk("a", 1, { total_points: 10 }), rk("b", 2, { total_points: 9 })];
    const predictions = new Map([
      ["a", { home: 0, away: 0 }], // empate previsto vs jogo com vencedor → miss (0 pts)
      ["b", { home: 3, away: 1 }], // exato na final → +34
    ]);
    const out = simulateMatchRanking({ entries, predictions, result: { home: 3, away: 1 }, stage: "final" });
    expect(out.get("b")!.points).toBe(34);
    expect(out.get("b")!.total).toBe(43);
    expect(out.get("b")!.rank).toBe(1);
    expect(out.get("b")!.delta).toBe(1); // subiu de 2 → 1
    expect(out.get("a")!.points).toBe(0);
    expect(out.get("a")!.rank).toBe(2);
    expect(out.get("a")!.delta).toBe(-1); // caiu de 1 → 2
  });

  it("não modifica os entries de entrada (imutável)", () => {
    const entries = [rk("a", 1, { total_points: 10 })];
    const predictions = new Map([["a", { home: 1, away: 0 }]]);
    simulateMatchRanking({ entries, predictions, result: { home: 1, away: 0 }, stage: "group" });
    expect(entries[0].total_points).toBe(10);
  });

  it("empate em total → desempate pela regra oficial (mais exacts_total vence)", () => {
    // Após a simulação a e b empatam em 12 pontos; a fez o placar exato, b só
    // acertou o vencedor — a deve ficar à frente por exacts_total.
    const entries = [rk("a", 2, { total_points: 5 }), rk("b", 1, { total_points: 10 })];
    const predictions = new Map([
      ["a", { home: 2, away: 1 }], // exato → +7 (group) → 12, exacts_total 1
      ["b", { home: 5, away: 0 }], // só vencedor → +2 (group) → 12, exacts_total 0
    ]);
    const out = simulateMatchRanking({ entries, predictions, result: { home: 2, away: 1 }, stage: "group" });
    expect(out.get("a")!.total).toBe(12);
    expect(out.get("b")!.total).toBe(12);
    expect(out.get("a")!.rank).toBe(1); // desempata por exacts_total
    expect(out.get("b")!.rank).toBe(2);
    expect(out.get("a")!.delta).toBe(1); // subiu de 2 → 1
    expect(out.get("b")!.delta).toBe(-1); // caiu de 1 → 2
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run src/lib/scoring/__tests__/simulate.test.ts`
Expected: FAIL — não consegue resolver `@/lib/scoring/simulate`.

- [ ] **Step 3: Implementar `simulate.ts`**

Criar `src/lib/scoring/simulate.ts`:

```ts
import type { Stage } from "@/lib/types/match";
import { score, type Tier } from "@/lib/scoring";
import {
  applyScoreToEntry,
  assignRanks,
  compareForRanking,
  type RankingEntry,
  type RankingRow,
} from "./ranking-core";

export type SimulatedRow = {
  points: number | null; // pontos desta partida (null = não palpitou)
  tier: Tier | null;
  total: number; // total no bolão já com a simulação
  rank: number; // rank simulado
  delta: number; // rankAtual - rankSimulado (positivo = subiu)
};

export function simulateMatchRanking(input: {
  entries: RankingRow[];
  predictions: Map<string, { home: number; away: number }>;
  result: { home: number; away: number };
  stage: Stage;
}): Map<string, SimulatedRow> {
  const { entries, predictions, result, stage } = input;

  const currentRank = new Map<string, number>();
  const perMatch = new Map<string, { points: number | null; tier: Tier | null }>();

  const clones: RankingEntry[] = entries.map((e) => {
    currentRank.set(e.user_id, e.rank);
    // Clona o entry. O campo extra `rank` é inofensivo: applyScoreToEntry e
    // compareForRanking o ignoram, e assignRanks o sobrescreve.
    const clone: RankingEntry = { ...e };

    const pred = predictions.get(e.user_id);
    if (pred) {
      const { points, tier } = score({
        prediction: { home_score: pred.home, away_score: pred.away },
        match: { home_score: result.home, away_score: result.away },
        stage,
      });
      applyScoreToEntry(clone, { points, tier, stage });
      perMatch.set(e.user_id, { points, tier });
    } else {
      perMatch.set(e.user_id, { points: null, tier: null });
    }
    return clone;
  });

  const ranked = assignRanks([...clones].sort(compareForRanking));

  const out = new Map<string, SimulatedRow>();
  for (const r of ranked) {
    const pm = perMatch.get(r.user_id)!;
    const prev = currentRank.get(r.user_id)!;
    out.set(r.user_id, {
      points: pm.points,
      tier: pm.tier,
      total: r.total_points,
      rank: r.rank,
      delta: prev - r.rank,
    });
  }
  return out;
}
```

- [ ] **Step 4: Rodar testes e lint**

Run: `npx vitest run src/lib/scoring/__tests__/simulate.test.ts`
Expected: PASS — os 4 casos.

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/simulate.ts src/lib/scoring/__tests__/simulate.test.ts
git commit -m "feat(scoring): simulateMatchRanking para simulacao de resultado"
```

---

## Task 3: Embutir `entry` em `MatchPredictionRow`

Cada linha passa a carregar a `RankingRow` de origem (todos os campos de pontuação + rank atual), tornando-a auto-suficiente para alimentar o recálculo no cliente.

**Files:**
- Modify: `src/app/(authenticated)/partidas/[matchId]/_lib/join-prediction-rows.ts`
- Test: `src/app/(authenticated)/partidas/[matchId]/_lib/__tests__/join-prediction-rows.test.ts`

- [ ] **Step 1: Adicionar teste do `entry` (falha)**

Adicionar dentro do `describe("joinPredictionRows", ...)` existente:

```ts
  it("embute o entry (RankingRow de origem) em cada linha", () => {
    const rows = joinPredictionRows({ ranking, predictions: [], scores: [] });
    expect(rows[0].entry).toEqual(ranking[0]);
    expect(rows[1].entry.user_id).toBe("u2");
    expect(rows[2].entry.total_points).toBe(0);
  });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run "src/app/(authenticated)/partidas/[matchId]/_lib/__tests__/join-prediction-rows.test.ts"`
Expected: FAIL — `entry` é `undefined` / erro de tipo (se rodar tsc).

- [ ] **Step 3: Implementar**

Em `join-prediction-rows.ts`, adicionar `entry` ao tipo `MatchPredictionRow` (o `import type { RankingRow }` já existe no topo do arquivo).

> **Desvio deliberado da spec:** a spec escreveu `entry: RankingEntry`, mas aqui usamos `entry: RankingRow` (o tipo completo, que inclui `rank`). É proposital — `simulateMatchRanking` lê `e.rank` para calcular o `delta`, e só `RankingRow` carrega esse campo. **Não** "corrigir" para `RankingEntry`.

```ts
export type MatchPredictionRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  rank: number;
  prediction: { home_score: number; away_score: number } | null;
  score: PredictionScore | null;
  entry: RankingRow;
};
```

E preencher no `map` final:

```ts
  return input.ranking.map((r) => {
    const pred = predByUser.get(r.user_id);
    return {
      user_id: r.user_id,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      rank: r.rank,
      prediction: pred ? { home_score: pred.home_score, away_score: pred.away_score } : null,
      score: scoreByUser.get(r.user_id) ?? null,
      entry: r,
    };
  });
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run "src/app/(authenticated)/partidas/[matchId]/_lib/__tests__/join-prediction-rows.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authenticated)/partidas/[matchId]/_lib/join-prediction-rows.ts" "src/app/(authenticated)/partidas/[matchId]/_lib/__tests__/join-prediction-rows.test.ts"
git commit -m "feat(partidas): embute RankingRow de origem em cada linha de palpite"
```

---

## Task 4: Componente `SimulationControls`

Painel com os dois campos numéricos (nomes dos times) e os botões Simular/Limpar. Sem teste unitário (convenção do repo); validado por lint + tsc.

**Files:**
- Create: `src/app/(authenticated)/partidas/[matchId]/_components/simulation-controls.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  homeName: string;
  awayName: string;
  active: boolean;
  onApply: (result: { home: number; away: number }) => void;
  onClear: () => void;
};

function parseScore(value: string): number | null {
  const v = value.trim();
  if (!/^\d{1,2}$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n <= 99 ? n : null;
}

export function SimulationControls({ homeName, awayName, active, onApply, onClear }: Props) {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");

  const homeVal = parseScore(home);
  const awayVal = parseScore(away);
  const valid = homeVal !== null && awayVal !== null;

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Simular resultado
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="sim-home" className="text-xs">
            {homeName}
          </Label>
          <Input
            id="sim-home"
            inputMode="numeric"
            value={home}
            onChange={(e) => setHome(e.target.value)}
            className="w-16 text-center"
            aria-label={`Placar simulado de ${homeName}`}
          />
        </div>

        <span className="pb-2 text-muted-foreground" aria-hidden>
          ×
        </span>

        <div className="flex flex-col gap-1">
          <Label htmlFor="sim-away" className="text-xs">
            {awayName}
          </Label>
          <Input
            id="sim-away"
            inputMode="numeric"
            value={away}
            onChange={(e) => setAway(e.target.value)}
            className="w-16 text-center"
            aria-label={`Placar simulado de ${awayName}`}
          />
        </div>

        <Button
          type="button"
          disabled={!valid}
          onClick={() => {
            if (homeVal !== null && awayVal !== null) onApply({ home: homeVal, away: awayVal });
          }}
        >
          Simular
        </Button>

        {active ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setHome("");
              setAway("");
              onClear();
            }}
          >
            Limpar
          </Button>
        ) : null}
      </div>

      {active ? (
        <p className="text-xs text-muted-foreground">
          Resultado hipotético — não altera dados oficiais.
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos e lint**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authenticated)/partidas/[matchId]/_components/simulation-controls.tsx"
git commit -m "feat(partidas): componente SimulationControls"
```

---

## Task 5: Renderização da simulação em `PredictionRow`, `PredictionsList` e `NoPredictionSection`

As linhas ganham colunas Pts (pontos da partida) e Total (total no bolão) + seta de variação; a lista reordena pela classificação simulada e o header mostra as colunas. Props novas têm default (`simulation = null` / `sim = null`), então a chamada atual da página (resultado oficial) continua compilando e funcionando sem mudança.

**Files:**
- Modify: `src/app/(authenticated)/partidas/[matchId]/_components/prediction-row.tsx`
- Modify: `src/app/(authenticated)/partidas/[matchId]/_components/predictions-list.tsx`
- Modify: `src/app/(authenticated)/partidas/[matchId]/_components/no-prediction-section.tsx`

- [ ] **Step 1: Reescrever `prediction-row.tsx`**

```tsx
import { ArrowDown, ArrowUp } from "lucide-react";
import { getInitials } from "@/app/(authenticated)/_components/avatar-fallback";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { SimulatedRow } from "@/lib/scoring/simulate";
import type { MatchPredictionRow } from "../_lib/join-prediction-rows";

type Props = {
  row: MatchPredictionRow;
  showPoints: boolean;
  sim?: SimulatedRow | null;
};

export function PredictionRow({ row, showPoints, sim = null }: Props) {
  const hasPrediction = row.prediction !== null;
  const rank = sim ? sim.rank : row.rank;
  const showPts = showPoints || sim !== null;

  return (
    <li className="flex items-center gap-3 border-b px-2 py-2 last:border-b-0">
      <span className="flex w-14 items-center justify-end gap-0.5 font-semibold tabular-nums text-muted-foreground">
        {sim && sim.delta > 0 ? (
          <span
            className="inline-flex items-center text-[10px] font-medium text-emerald-600"
            aria-label={`subiu ${sim.delta} posições`}
          >
            <ArrowUp className="size-3" aria-hidden />
            {sim.delta}
          </span>
        ) : sim && sim.delta < 0 ? (
          <span
            className="inline-flex items-center text-[10px] font-medium text-red-600"
            aria-label={`desceu ${-sim.delta} posições`}
          >
            <ArrowDown className="size-3" aria-hidden />
            {-sim.delta}
          </span>
        ) : null}
        <span>{rank}</span>
      </span>

      <Avatar className="size-7 shrink-0">
        {row.avatar_url ? <AvatarImage src={row.avatar_url} alt="" /> : null}
        <AvatarFallback className="text-xs">{getInitials(row.display_name)}</AvatarFallback>
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

      {showPts ? (
        <span
          className="w-12 text-right tabular-nums text-sm"
          aria-label={
            sim
              ? sim.points === null
                ? "sem pontos nesta partida"
                : `${sim.points} pontos`
              : `${row.score?.points ?? 0} pontos`
          }
        >
          {sim ? (sim.points ?? "—") : (row.score?.points ?? 0)}
        </span>
      ) : null}

      {sim ? (
        <span
          className="w-16 text-right tabular-nums text-sm font-semibold"
          aria-label={`total ${sim.total} pontos`}
        >
          {sim.total}
        </span>
      ) : null}
    </li>
  );
}
```

- [ ] **Step 2: Editar `predictions-list.tsx`**

Adicionar import:

```ts
import type { SimulatedRow } from "@/lib/scoring/simulate";
```

Trocar o tipo `Props` e a assinatura/lógica do componente:

```ts
type Props = {
  rows: MatchPredictionRow[];
  showPoints: boolean;
  simulation?: Map<string, SimulatedRow> | null;
};

export function PredictionsList({ rows, showPoints, simulation = null }: Props) {
  const [query, setQuery] = useState("");
  const simulating = simulation !== null;

  const filtered = useMemo(() => filterByName(rows, query), [rows, query]);

  const sortBySim = (list: MatchPredictionRow[]) =>
    simulation
      ? [...list].sort(
          (a, b) =>
            (simulation.get(a.user_id)?.rank ?? Number.POSITIVE_INFINITY) -
            (simulation.get(b.user_id)?.rank ?? Number.POSITIVE_INFINITY),
        )
      : list;

  const withPrediction = sortBySim(filtered.filter((r) => r.prediction !== null));
  const withoutPrediction = sortBySim(filtered.filter((r) => r.prediction === null));

  const noResults = query.trim() !== "" && filtered.length === 0;
```

No header da lista "com palpite", trocar a largura do `#` para `w-14` e ajustar as colunas à direita:

```tsx
              <div className="flex items-center gap-3 border-b bg-muted/50 px-2 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <span className="w-14 text-right">#</span>
                <span className="size-7 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">Participante</span>
                <span className="w-16 text-right">Palpite</span>
                {showPoints || simulating ? <span className="w-12 text-right">Pts</span> : null}
                {simulating ? <span className="w-16 text-right">Total</span> : null}
              </div>
```

Passar `sim` em cada `PredictionRow` da lista "com palpite":

```tsx
                {withPrediction.map((row) => (
                  <PredictionRow
                    key={row.user_id}
                    row={row}
                    showPoints={showPoints}
                    sim={simulation?.get(row.user_id) ?? null}
                  />
                ))}
```

E repassar a simulação para a seção "sem palpite":

```tsx
          <NoPredictionSection rows={withoutPrediction} simulation={simulation} />
```

- [ ] **Step 3: Editar `no-prediction-section.tsx`**

```tsx
import { PredictionRow } from "./prediction-row";
import type { SimulatedRow } from "@/lib/scoring/simulate";
import type { MatchPredictionRow } from "../_lib/join-prediction-rows";

export function NoPredictionSection({
  rows,
  simulation = null,
}: {
  rows: MatchPredictionRow[];
  simulation?: Map<string, SimulatedRow> | null;
}) {
  if (rows.length === 0) return null;
  return (
    <details className="rounded-md border bg-muted/30">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-muted-foreground">
        Sem palpite ({rows.length})
      </summary>
      <ul className="px-1 pb-2">
        {rows.map((row) => (
          <PredictionRow
            key={row.user_id}
            row={row}
            showPoints={false}
            sim={simulation?.get(row.user_id) ?? null}
          />
        ))}
      </ul>
    </details>
  );
}
```

- [ ] **Step 4: Verificar tipos e lint**

Run: `npx tsc --noEmit`
Expected: sem erros (a chamada atual `<PredictionsList rows={...} showPoints={hasResult} />` em `page.tsx` ainda compila — `simulation` tem default).

Run: `npm run lint`
Expected: sem erros novos.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authenticated)/partidas/[matchId]/_components/prediction-row.tsx" "src/app/(authenticated)/partidas/[matchId]/_components/predictions-list.tsx" "src/app/(authenticated)/partidas/[matchId]/_components/no-prediction-section.tsx"
git commit -m "feat(partidas): colunas Pts/Total e seta de variacao na lista simulada"
```

---

## Task 6: `MatchSimulator` + ligação na `page.tsx`

Wrapper cliente que detém o estado da simulação, adapta `rows` para a função pura e renderiza os controles + a lista. A página decide quando ele aparece.

**Files:**
- Create: `src/app/(authenticated)/partidas/[matchId]/_components/match-simulator.tsx`
- Modify: `src/app/(authenticated)/partidas/[matchId]/page.tsx`

- [ ] **Step 1: Criar `match-simulator.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { simulateMatchRanking } from "@/lib/scoring/simulate";
import type { Stage } from "@/lib/types/match";
import { SimulationControls } from "./simulation-controls";
import { PredictionsList } from "./predictions-list";
import type { MatchPredictionRow } from "../_lib/join-prediction-rows";

type Props = {
  rows: MatchPredictionRow[];
  stage: Stage;
  homeName: string;
  awayName: string;
};

export function MatchSimulator({ rows, stage, homeName, awayName }: Props) {
  const [result, setResult] = useState<{ home: number; away: number } | null>(null);

  const hasAnyPrediction = useMemo(
    () => rows.some((r) => r.prediction !== null),
    [rows],
  );

  const simulation = useMemo(() => {
    if (!result) return null;
    const entries = rows.map((r) => r.entry);
    const predictions = new Map(
      rows
        .filter((r) => r.prediction !== null)
        .map(
          (r) =>
            [
              r.user_id,
              { home: r.prediction!.home_score, away: r.prediction!.away_score },
            ] as const,
        ),
    );
    return simulateMatchRanking({ entries, predictions, result, stage });
  }, [result, rows, stage]);

  return (
    <div className="flex flex-col gap-4">
      {hasAnyPrediction ? (
        <SimulationControls
          homeName={homeName}
          awayName={awayName}
          active={simulation !== null}
          onApply={setResult}
          onClear={() => setResult(null)}
        />
      ) : null}
      <PredictionsList rows={rows} showPoints={false} simulation={simulation} />
    </div>
  );
}
```

- [ ] **Step 2: Ligar na `page.tsx`**

Substituir o conteúdo de `src/app/(authenticated)/partidas/[matchId]/page.tsx` por:

```tsx
import { notFound } from "next/navigation";
import { getMatchPredictions } from "./_lib/get-match-predictions";
import { MatchHeader } from "./_components/match-header";
import { PredictionsList } from "./_components/predictions-list";
import { MatchSimulator } from "./_components/match-simulator";

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

  const canSimulate =
    match.home_score === null &&
    match.away_score === null &&
    match.status !== "cancelled" &&
    match.status !== "postponed";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <MatchHeader match={match} />
      {canSimulate ? (
        <MatchSimulator
          rows={predictions}
          stage={match.stage}
          homeName={match.home_team?.name ?? "Mandante"}
          awayName={match.away_team?.name ?? "Visitante"}
        />
      ) : (
        <PredictionsList rows={predictions} showPoints={hasResult} />
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verificar tipos, lint e suíte completa**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run lint`
Expected: sem erros novos.

Run: `npm test`
Expected: PASS — toda a suíte (scoring + _lib).

- [ ] **Step 4: Verificação manual no dev server**

Run: `npm run dev`

Abrir uma partida em `/partidas/[matchId]` que esteja **aguardando resultado oficial** (kickoff já passou, sem placar) e que tenha palpites. Conferir:
- O painel "Simular resultado" aparece com os nomes dos dois times.
- "Simular" fica desabilitado até os dois campos terem inteiros válidos (0–99).
- Ao simular: surgem as colunas **Pts** (pontos da partida) e **Total** (total no bolão), a seção "com palpite" reordena pelo rank simulado e as setas ↑/↓ aparecem em quem mudou de posição.
- "Limpar" volta a lista ao estado normal (sem Pts/Total, ordem original).
- A busca por nome continua funcionando durante a simulação.
- Quem não palpitou: na seção "Sem palpite", mostra "—" em Pts, o Total atual e a seta se mudou de posição.

Conferir também os estados que **não** simulam:
- Partida com **resultado oficial**: sem painel; coluna Pts oficial como antes; sem coluna Total.
- Partida **cancelada/adiada**: sem painel; comportamento atual.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authenticated)/partidas/[matchId]/_components/match-simulator.tsx" "src/app/(authenticated)/partidas/[matchId]/page.tsx"
git commit -m "feat(partidas): simulacao de resultado na pagina da partida"
```

---

## Verificação final

- [ ] `npm test` — toda a suíte verde.
- [ ] `npx tsc --noEmit` — sem erros de tipo.
- [ ] `npm run lint` — sem erros novos.
- [ ] Checagem manual dos três estados (aguardando/oficial/cancelada) conforme Task 6, Step 4.

## Notas de implementação

- **DRY:** `applyScoreToEntry` é a única fonte da regra de acumulação (oficial e simulada).
- **YAGNI:** sem persistência, sem URL compartilhável, sem prorrogação/pênaltis, sem botões de placar rápido.
- **Imutabilidade:** `simulateMatchRanking` clona os entries; não muta a entrada (coberto por teste).
- **Larguras de coluna:** o `#` passou de `w-8` para `w-14` para caber a seta; header e linha devem usar a mesma largura para alinhar. Ajuste fino é esperado na verificação manual.
- **Layout mobile:** o painel usa `flex-wrap`; em telas estreitas os campos/botões quebram em linha. Confirmar na checagem manual.
