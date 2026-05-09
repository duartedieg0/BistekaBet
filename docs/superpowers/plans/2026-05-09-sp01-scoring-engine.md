# SP-01 Scoring Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um módulo TypeScript puro `src/lib/scoring/` que, dado `(palpite, resultado_tempo_normal, fase)`, retorne `{ points, tier }` aderente integralmente ao regulamento (§5–§9) e validado por suíte de testes contra todos os exemplos do documento oficial.

**Architecture:** Biblioteca isolada, sem I/O, sem dependências de runtime (Next/Supabase). API mínima: `score(input)` + `POINTS_TABLE` + tipos `Tier`/`ScoreInput`/`ScoreOutput`. Testes em vitest. Sem migrations, sem rotas, sem UI, sem server actions.

**Tech Stack:** TypeScript 5 · vitest (novo dev dep) · Next.js 16 (apenas para coexistir no monorepo, não consumido pela engine).

**Spec:** `docs/superpowers/specs/2026-05-09-sp01-scoring-engine-design.md`
**Plano macro:** `docs/superpowers/specs/2026-05-09-plano-macro-regulamento.md`
**Regulamento:** `docs/regulamento.md`

**Notas para o executor:**
- Projeto **ainda não tem** suíte de testes. Esta plano introduz `vitest` como devDependency (Task 1).
- Package manager: **npm** (`package-lock.json`).
- A engine reusa o tipo `Stage` já exportado de `src/lib/types/match.ts`. **Não duplicar.**
- **Não tocar** em schema, RLS, server actions, rotas ou UI nesta tarefa. Tudo isso é responsabilidade de SP-02+.
- TDD estrito: escrever teste → ver falhar → implementar → ver passar → commit.

---

## File Structure

**Criar:**
- `vitest.config.ts` — configuração mínima (alias `@/*` → `src/*`).
- `src/lib/scoring/index.ts` — re-exports da API pública.
- `src/lib/scoring/points-table.ts` — `POINTS_TABLE` (espelha §6).
- `src/lib/scoring/score.ts` — função `score()` + tipos `Tier`, `ScoreInput`, `ScoreOutput`.
- `src/lib/scoring/__tests__/points-table.test.ts`
- `src/lib/scoring/__tests__/score.test.ts`
- `src/lib/scoring/__tests__/score.cross-stage.test.ts`
- `src/lib/scoring/__tests__/score.invariants.test.ts`
- `docs/superpowers/specs/2026-05-09-sp01-scoring-engine-adr.md` — ADR.

**Modificar:**
- `package.json` — adicionar `vitest` em devDependencies + scripts `test` e `test:watch`.
- `tsconfig.json` — incluir `vitest/globals` em `types` (opcional; usaremos imports explícitos para evitar mexer em `tsconfig`).
- `eslint.config.mjs` — verificar se ignora `__tests__` ou se precisa de ajuste (Task 1 step de validação).

---

## Task 1: Setup do runner de testes (vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Instalar vitest como devDependency**

Run:
```
npm install --save-dev vitest @vitest/coverage-v8
```

Expected: `vitest` e `@vitest/coverage-v8` adicionados em `devDependencies` de `package.json`; `package-lock.json` atualizado.

- [ ] **Step 2: Adicionar scripts em `package.json`**

Editar `package.json` para que `scripts` fique:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Criar `vitest.config.ts` na raiz**

Conteúdo:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Verificar que vitest roda (sem testes ainda)**

Run: `npm test`
Expected: vitest sobe, reporta `No test files found, exiting with code 1` ou similar. Isso é OK por enquanto.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore(test): add vitest runner"
```

---

## Task 2: Tipos públicos e POINTS_TABLE (test-first)

**Files:**
- Test: `src/lib/scoring/__tests__/points-table.test.ts`
- Create: `src/lib/scoring/points-table.ts`
- Create: `src/lib/scoring/score.ts` (apenas tipos por ora)
- Create: `src/lib/scoring/index.ts`

- [ ] **Step 1: Escrever o teste falho**

Criar `src/lib/scoring/__tests__/points-table.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { POINTS_TABLE } from "@/lib/scoring";

describe("POINTS_TABLE (§6 — espelha o regulamento)", () => {
  it("Fase de grupos", () => {
    expect(POINTS_TABLE.group).toEqual({
      winner_or_draw: 2, winner_plus_goals: 4, exact: 7,
    });
  });
  it("32 avos", () => {
    expect(POINTS_TABLE.round_of_32).toEqual({
      winner_or_draw: 3, winner_plus_goals: 6, exact: 10,
    });
  });
  it("Oitavas (round_of_16)", () => {
    expect(POINTS_TABLE.round_of_16).toEqual({
      winner_or_draw: 4, winner_plus_goals: 8, exact: 13,
    });
  });
  it("Quartas", () => {
    expect(POINTS_TABLE.quarter).toEqual({
      winner_or_draw: 6, winner_plus_goals: 11, exact: 18,
    });
  });
  it("Semifinal", () => {
    expect(POINTS_TABLE.semi).toEqual({
      winner_or_draw: 8, winner_plus_goals: 15, exact: 25,
    });
  });
  it("3º lugar (§9)", () => {
    expect(POINTS_TABLE.third_place).toEqual({
      winner_or_draw: 7, winner_plus_goals: 13, exact: 22,
    });
  });
  it("Final", () => {
    expect(POINTS_TABLE.final).toEqual({
      winner_or_draw: 11, winner_plus_goals: 20, exact: 34,
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test`
Expected: falha em `points-table.test.ts` com erro de import (`Cannot find module '@/lib/scoring'`).

- [ ] **Step 3: Implementar `points-table.ts`**

Criar `src/lib/scoring/points-table.ts`:

```ts
import type { Stage } from "@/lib/types/match";

export const POINTS_TABLE: Readonly<Record<Stage, {
  winner_or_draw: number;
  winner_plus_goals: number;
  exact: number;
}>> = {
  group:        { winner_or_draw: 2,  winner_plus_goals: 4,  exact: 7  },
  round_of_32:  { winner_or_draw: 3,  winner_plus_goals: 6,  exact: 10 },
  round_of_16:  { winner_or_draw: 4,  winner_plus_goals: 8,  exact: 13 },
  quarter:      { winner_or_draw: 6,  winner_plus_goals: 11, exact: 18 },
  semi:         { winner_or_draw: 8,  winner_plus_goals: 15, exact: 25 },
  third_place:  { winner_or_draw: 7,  winner_plus_goals: 13, exact: 22 },
  final:        { winner_or_draw: 11, winner_plus_goals: 20, exact: 34 },
} as const;
```

- [ ] **Step 4: Criar tipos em `score.ts` (sem implementação ainda)**

Criar `src/lib/scoring/score.ts`:

```ts
import type { Stage } from "@/lib/types/match";

export type Tier = "exact" | "winner_or_draw" | "miss";

export type ScoreInput = {
  prediction: { home_score: number; away_score: number };
  match:      { home_score: number; away_score: number };
  stage:      Stage;
};

export type ScoreOutput = { points: number; tier: Tier };

export function score(_input: ScoreInput): ScoreOutput {
  throw new Error("not implemented");
}
```

- [ ] **Step 5: Criar `index.ts`**

Criar `src/lib/scoring/index.ts`:

```ts
export { POINTS_TABLE } from "./points-table";
export { score } from "./score";
export type { Tier, ScoreInput, ScoreOutput } from "./score";
```

- [ ] **Step 6: Rodar testes e confirmar passa**

Run: `npm test`
Expected: 7 testes de `points-table.test.ts` passam.

- [ ] **Step 7: Verificar tipagem**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/lib/scoring package.json
git commit -m "feat(scoring): add POINTS_TABLE and public types"
```

---

## Task 3: Função `score()` — exemplos do regulamento (test-first)

**Files:**
- Test: `src/lib/scoring/__tests__/score.test.ts`
- Modify: `src/lib/scoring/score.ts`

- [ ] **Step 1: Escrever os testes falhos**

Criar `src/lib/scoring/__tests__/score.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { score } from "@/lib/scoring";

const m = (h: number, a: number) => ({ home_score: h, away_score: a });

describe("score() — exemplos numerados do regulamento", () => {
  it("§7.1: acerto do vencedor (Brasil 2x1, palpite 1x0) — group", () => {
    expect(score({ prediction: m(1, 0), match: m(2, 1), stage: "group" }))
      .toEqual({ points: 2, tier: "winner_or_draw" });
  });

  it("§7.2 ex.1: vencedor + gols (2x1 real, palpite 3x1) — group", () => {
    expect(score({ prediction: m(3, 1), match: m(2, 1), stage: "group" }))
      .toEqual({ points: 4, tier: "winner_or_draw" });
  });

  it("§7.2 ex.2: vencedor + 0 gols conta (1x0 real, palpite 2x0) — group", () => {
    expect(score({ prediction: m(2, 0), match: m(1, 0), stage: "group" }))
      .toEqual({ points: 4, tier: "winner_or_draw" });
  });

  it("§7.3: placar exato (2x1 real, palpite 2x1) — group", () => {
    expect(score({ prediction: m(2, 1), match: m(2, 1), stage: "group" }))
      .toEqual({ points: 7, tier: "exact" });
  });

  it("§8 ex.1: acerto do empate sem placar exato (1x1 real, palpite 2x2) — group", () => {
    expect(score({ prediction: m(2, 2), match: m(1, 1), stage: "group" }))
      .toEqual({ points: 2, tier: "winner_or_draw" });
  });

  it("§8 ex.2: placar exato em empate (1x1 real, palpite 1x1) — group", () => {
    expect(score({ prediction: m(1, 1), match: m(1, 1), stage: "group" }))
      .toEqual({ points: 7, tier: "exact" });
  });
});

describe("score() — casos de borda", () => {
  it("vencedor invertido vale 0 (Brasil 2x1, palpite 1x2)", () => {
    expect(score({ prediction: m(1, 2), match: m(2, 1), stage: "group" }))
      .toEqual({ points: 0, tier: "miss" });
  });

  it("palpite de empate em jogo decidido vale 0 (2x1 real, palpite 1x1)", () => {
    expect(score({ prediction: m(1, 1), match: m(2, 1), stage: "group" }))
      .toEqual({ points: 0, tier: "miss" });
  });

  it("palpite com vencedor em jogo empatado vale 0 (1x1 real, palpite 2x1)", () => {
    expect(score({ prediction: m(2, 1), match: m(1, 1), stage: "group" }))
      .toEqual({ points: 0, tier: "miss" });
  });

  it("0x0 exato (group)", () => {
    expect(score({ prediction: m(0, 0), match: m(0, 0), stage: "group" }))
      .toEqual({ points: 7, tier: "exact" });
  });

  it("0x0 real, palpite 1x1 — acerto do empate", () => {
    expect(score({ prediction: m(1, 1), match: m(0, 0), stage: "group" }))
      .toEqual({ points: 2, tier: "winner_or_draw" });
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test`
Expected: `score.test.ts` falha em todos os casos com `Error: not implemented`.

- [ ] **Step 3: Implementar `score()`**

Substituir o corpo de `score()` em `src/lib/scoring/score.ts`:

```ts
import type { Stage } from "@/lib/types/match";
import { POINTS_TABLE } from "./points-table";

export type Tier = "exact" | "winner_or_draw" | "miss";

export type ScoreInput = {
  prediction: { home_score: number; away_score: number };
  match:      { home_score: number; away_score: number };
  stage:      Stage;
};

export type ScoreOutput = { points: number; tier: Tier };

export function score({ prediction, match, stage }: ScoreInput): ScoreOutput {
  const p = POINTS_TABLE[stage];
  const ph = prediction.home_score;
  const pa = prediction.away_score;
  const mh = match.home_score;
  const ma = match.away_score;

  // §7.3 / §8 ex.2: placar exato (precedência absoluta — não cumulativo §6)
  if (ph === mh && pa === ma) {
    return { points: p.exact, tier: "exact" };
  }

  const matchIsDraw = mh === ma;
  const predictionIsDraw = ph === pa;

  // §8: jogo empatou no tempo normal
  if (matchIsDraw) {
    if (predictionIsDraw) {
      return { points: p.winner_or_draw, tier: "winner_or_draw" };
    }
    return { points: 0, tier: "miss" };
  }

  // §7: jogo com vencedor
  const matchHomeWon = mh > ma;
  const predictionHomeWon = ph > pa;
  const sameWinner = !predictionIsDraw && matchHomeWon === predictionHomeWon;

  if (!sameWinner) return { points: 0, tier: "miss" };

  // §7.2: vencedor + gols de pelo menos um time (0 gols conta)
  if (ph === mh || pa === ma) {
    return { points: p.winner_plus_goals, tier: "winner_or_draw" };
  }

  // §7.1: só o vencedor
  return { points: p.winner_or_draw, tier: "winner_or_draw" };
}
```

- [ ] **Step 4: Rodar testes e confirmar passam**

Run: `npm test`
Expected: 7 testes de points-table + 11 testes de score = **18 testes verdes**.

- [ ] **Step 5: Verificar tipagem**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring
git commit -m "feat(scoring): implement score() per regulamento §7 and §8"
```

---

## Task 4: Cross-stage test (mesma combinação em 7 stages)

**Files:**
- Test: `src/lib/scoring/__tests__/score.cross-stage.test.ts`

- [ ] **Step 1: Escrever o teste**

Criar `src/lib/scoring/__tests__/score.cross-stage.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { score, POINTS_TABLE } from "@/lib/scoring";
import { STAGES } from "@/lib/types/match";

const m = (h: number, a: number) => ({ home_score: h, away_score: a });

describe("score() — paga conforme tabela em todas as 7 fases", () => {
  for (const stage of STAGES) {
    const expected = POINTS_TABLE[stage];

    it(`${stage}: placar exato → exact`, () => {
      expect(score({ prediction: m(2, 1), match: m(2, 1), stage }))
        .toEqual({ points: expected.exact, tier: "exact" });
    });

    it(`${stage}: vencedor + gols → winner_plus_goals`, () => {
      expect(score({ prediction: m(3, 1), match: m(2, 1), stage }))
        .toEqual({ points: expected.winner_plus_goals, tier: "winner_or_draw" });
    });

    it(`${stage}: só vencedor → winner_or_draw`, () => {
      expect(score({ prediction: m(1, 0), match: m(2, 1), stage }))
        .toEqual({ points: expected.winner_or_draw, tier: "winner_or_draw" });
    });

    it(`${stage}: empate sem exato → winner_or_draw`, () => {
      expect(score({ prediction: m(2, 2), match: m(1, 1), stage }))
        .toEqual({ points: expected.winner_or_draw, tier: "winner_or_draw" });
    });

    it(`${stage}: vencedor invertido → miss`, () => {
      expect(score({ prediction: m(1, 2), match: m(2, 1), stage }))
        .toEqual({ points: 0, tier: "miss" });
    });
  }
});
```

- [ ] **Step 2: Rodar e confirmar passa**

Run: `npm test`
Expected: + 35 testes (5 × 7 stages) verdes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring/__tests__/score.cross-stage.test.ts
git commit -m "test(scoring): cross-stage coverage of POINTS_TABLE"
```

---

## Task 5: Testes de invariantes

**Files:**
- Test: `src/lib/scoring/__tests__/score.invariants.test.ts`

- [ ] **Step 1: Escrever o teste**

Criar `src/lib/scoring/__tests__/score.invariants.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { score, POINTS_TABLE, type ScoreInput } from "@/lib/scoring";
import { STAGES } from "@/lib/types/match";

const m = (h: number, a: number) => ({ home_score: h, away_score: a });

const SAMPLES: ScoreInput[] = [
  { prediction: m(2, 1), match: m(2, 1), stage: "group" },
  { prediction: m(3, 1), match: m(2, 1), stage: "final" },
  { prediction: m(1, 0), match: m(2, 1), stage: "semi" },
  { prediction: m(2, 2), match: m(1, 1), stage: "quarter" },
  { prediction: m(1, 2), match: m(2, 1), stage: "round_of_16" },
  { prediction: m(0, 0), match: m(0, 0), stage: "third_place" },
];

describe("score() — invariantes", () => {
  it("tier 'exact' implica points = POINTS_TABLE[stage].exact", () => {
    for (const s of SAMPLES) {
      const r = score(s);
      if (r.tier === "exact") {
        expect(r.points).toBe(POINTS_TABLE[s.stage].exact);
      }
    }
  });

  it("tier 'winner_or_draw' implica points > 0", () => {
    for (const s of SAMPLES) {
      const r = score(s);
      if (r.tier === "winner_or_draw") {
        expect(r.points).toBeGreaterThan(0);
      }
    }
  });

  it("tier 'miss' implica points = 0", () => {
    for (const s of SAMPLES) {
      const r = score(s);
      if (r.tier === "miss") {
        expect(r.points).toBe(0);
      }
    }
  });

  it("é determinística: mesma entrada → mesma saída (1000 chamadas)", () => {
    for (const stage of STAGES) {
      const input: ScoreInput = { prediction: m(2, 1), match: m(2, 1), stage };
      const first = score(input);
      for (let i = 0; i < 1000; i++) {
        expect(score(input)).toEqual(first);
      }
    }
  });

  it("nunca retorna points negativos ou NaN", () => {
    for (const s of SAMPLES) {
      const r = score(s);
      expect(Number.isFinite(r.points)).toBe(true);
      expect(r.points).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 2: Rodar e confirmar passa**

Run: `npm test`
Expected: + 5 testes verdes; suíte total ≥ 58 verdes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring/__tests__/score.invariants.test.ts
git commit -m "test(scoring): invariants and determinism"
```

---

## Task 6: ADR (Architecture Decision Record)

**Files:**
- Create: `docs/superpowers/specs/2026-05-09-sp01-scoring-engine-adr.md`

- [ ] **Step 1: Criar o ADR**

Conteúdo de `docs/superpowers/specs/2026-05-09-sp01-scoring-engine-adr.md`:

```markdown
# ADR · SP-01 Scoring Engine

**Data:** 2026-05-09
**Status:** Aceito
**Spec:** `2026-05-09-sp01-scoring-engine-design.md`
**Regulamento:** `docs/regulamento.md`

## Contexto

O regulamento (§5–§9) define a tabela e as regras de pontuação do bolão. A engine
precisa ser fonte única de verdade para todos os consumidores (SP-02, SP-03, SP-04).

## Decisões

| ID | Decisão | Cláusula | Justificativa |
|---|---|---|---|
| D1 | `matches.home_score`/`away_score` representam o placar do tempo normal | §5 | ET e pênaltis ficam em colunas próprias, irrelevantes ao scoring |
| D2 | Engine é TS puro; SP-02 materializa `{ points, tier }` em `prediction_scores` | §6, §11 | Testabilidade contra exemplos do regulamento; SP-03 vira agregação trivial |
| D3 | Tier reduzido: `exact \| winner_or_draw \| miss` | §12.1, §12.2, §12.3 | Suficiente para todos os critérios de desempate; a UI deriva detalhe a partir de `points + match.result` |
| D4 | Palpite ausente não chega à engine; SP-02 grava `{0, 'miss'}` direto | §3 | Mantém engine pura; separa policy de cálculo |
| D5 | Partida sem resultado oficial não é submetida à engine | §11 | Idem D4 |
| D6 | Reuso de `Stage` de `src/lib/types/match.ts` | — | Fonte única do domínio |

## Mapeamento exemplos do regulamento → testes

| Cláusula | Exemplo | Teste |
|---|---|---|
| §7.1 | Brasil 2x1, palpite 1x0 → vencedor | `score.test.ts` |
| §7.2 ex.1 | Brasil 2x1, palpite 3x1 → vencedor + gols | `score.test.ts` |
| §7.2 ex.2 | Brasil 1x0, palpite 2x0 → 0 gols conta | `score.test.ts` |
| §7.3 | 2x1 real, 2x1 palpite → exato | `score.test.ts` |
| §8 ex.1 | 1x1 real, 2x2 palpite → empate | `score.test.ts` |
| §8 ex.2 | 1x1 real, 1x1 palpite → exato | `score.test.ts` |
| §6 (tabela) | 21 células × 7 fases | `points-table.test.ts` + `score.cross-stage.test.ts` |
| §9 | Linha "3º lugar" da tabela | `points-table.test.ts` (`third_place`) |

## Consequências

- Alterações futuras na tabela de pontos exigem update simultâneo em
  `points-table.ts` e `points-table.test.ts` — falha intencional caso alguém
  esqueça um dos dois.
- A regra "não cumulativa" (§6) é garantida pela ordem das verificações em
  `score.ts`: `exact` tem precedência absoluta; demais ramos são exclusivos.
- A redução do tier (D3) impede que SP-03 ofereça desempate por "vencedor + gols".
  Caso o regulamento mude para incluir esse critério, a tabela de tiers e a
  engine precisam ser revisadas.

## Não-objetivos (para SP-01)

- Persistência, recálculo em massa, ranking, desempate, UI, server actions, RLS.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-09-sp01-scoring-engine-adr.md
git commit -m "docs(scoring): ADR mapping decisions to regulamento clauses"
```

---

## Task 7: Verificação final

**Files:**
- nenhum (apenas validação)

- [ ] **Step 1: Rodar suíte completa**

Run: `npm test`
Expected: todos os testes verdes; nenhum `skip`.

- [ ] **Step 2: Cobertura**

Run: `npx vitest run --coverage`
Expected: cobertura de `src/lib/scoring/score.ts` e `src/lib/scoring/points-table.ts` em **100%** de linhas, branches e funções. Caso < 100%, adicionar caso de teste para o branch faltante e voltar a Task 3.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: sem novos warnings/errors em `src/lib/scoring/`.

- [ ] **Step 5: Build de produção**

Run: `npm run build`
Expected: build do Next.js sem erros (a engine não é importada por nenhum entrypoint ainda; deve ser tree-shaken).

- [ ] **Step 6: Confirmar isolamento (sem regressão fora de SP-01)**

Run: `git diff --stat main...HEAD`
Expected: apenas arquivos listados em "File Structure" foram alterados. Nenhuma mudança em `supabase/sql/`, `src/app/`, `src/components/`, ou tipos fora de `src/lib/scoring/`.

---

## Done criteria

- [x] `vitest` configurado e roda via `npm test`.
- [x] `src/lib/scoring/` exporta `score`, `POINTS_TABLE`, `Tier`, `ScoreInput`, `ScoreOutput`.
- [x] Todos os exemplos numerados do regulamento (§7.1, §7.2 ex.1, §7.2 ex.2, §7.3, §8 ex.1, §8 ex.2) cobertos por testes nomeados pela cláusula.
- [x] Tabela §6 espelhada literalmente, com teste por linha.
- [x] Cobertura 100% em `score.ts` e `points-table.ts`.
- [x] Typecheck, lint e build passam.
- [x] ADR documenta cada decisão e mapeia para cláusula.
- [x] Nenhuma alteração fora de `src/lib/scoring/`, `vitest.config.ts`, `package.json`, `package-lock.json`, e `docs/superpowers/`.
