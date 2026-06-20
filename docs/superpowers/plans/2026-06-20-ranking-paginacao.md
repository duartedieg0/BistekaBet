# Ranking · Correção da soma por paginação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer `loadRanking` ler todas as linhas de `prediction_scores` via paginação, corrigindo a classificação que somava menos por causa do teto de 1000 linhas do PostgREST.

**Architecture:** Um helper puro `paginateAll<T>` controla o laço de paginação por offset (testável sem Supabase). `loadRanking` usa esse helper com `.order("prediction_id").range(from, to)` para a query de `prediction_scores`; o `aggregate` (engine §6/§12) fica intacto.

**Tech Stack:** TypeScript, Next.js (Server Components), Supabase JS (`@supabase/supabase-js`), Vitest.

**Spec:** [`docs/superpowers/specs/2026-06-20-ranking-paginacao-design.md`](../specs/2026-06-20-ranking-paginacao-design.md)

**Branch:** `fix/ranking-soma-paginacao`

---

## Contexto essencial para quem implementa

- **O bug:** `src/lib/scoring/ranking.ts` (`loadRanking`) lê `prediction_scores` numa única query sem paginação. O PostgREST do Supabase corta o resultado em 1000 linhas (`db-max-rows`, default 1000). Com 1122 linhas na tabela, ~122 ficam de fora e o total exibido fica menor que `select sum(points) ... ` no banco.
- **O que NÃO mudar:** `src/lib/scoring/score.ts`, `src/lib/scoring/ranking-core.ts` (`aggregate`, `compareForRanking`, `assignRanks`) e a UI. A matemática está correta e testada.
- **Comandos de teste:** suíte inteira → `npm test`. Um arquivo só → `npx vitest run <caminho>`.
- **Alias de import:** o projeto usa `@/` para `src/` (ex.: `@/lib/supabase/paginate`).

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `src/lib/supabase/paginate.ts` | Helper puro de paginação por offset (laço + condição de parada) | Criar |
| `src/lib/supabase/__tests__/paginate.test.ts` | Testes do helper (batching, parada, ordem) | Criar |
| `src/lib/scoring/ranking.ts` | Trocar a leitura única de `prediction_scores` por leitura paginada | Modificar |

---

## Task 1: Helper `paginateAll`

**Files:**
- Create: `src/lib/supabase/paginate.ts`
- Test: `src/lib/supabase/__tests__/paginate.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/supabase/__tests__/paginate.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { paginateAll } from "@/lib/supabase/paginate";

// Fetcher falso sobre um array em memória; retorna a página [from, to] inclusiva.
function makeFetcher(total: number) {
  const rows = Array.from({ length: total }, (_, i) => i);
  const calls: Array<[number, number]> = [];
  const fetchPage = vi.fn(async (from: number, to: number) => {
    calls.push([from, to]);
    return rows.slice(from, to + 1);
  });
  return { rows, calls, fetchPage };
}

describe("paginateAll", () => {
  it("0 linhas → [] em 1 chamada", async () => {
    const { fetchPage, calls } = makeFetcher(0);
    const out = await paginateAll(fetchPage, 10);
    expect(out).toEqual([]);
    expect(calls).toEqual([[0, 9]]);
  });

  it("menos que pageSize → todas em 1 chamada", async () => {
    const { rows, fetchPage, calls } = makeFetcher(7);
    const out = await paginateAll(fetchPage, 10);
    expect(out).toEqual(rows);
    expect(calls).toHaveLength(1);
  });

  it("total não-múltiplo → todas as linhas, para na página curta", async () => {
    const { rows, fetchPage, calls } = makeFetcher(25);
    const out = await paginateAll(fetchPage, 10);
    expect(out).toEqual(rows);
    expect(out).toHaveLength(25);
    expect(calls).toEqual([[0, 9], [10, 19], [20, 29]]);
  });

  it("total múltiplo exato → última página vazia encerra, sem repetir/pular", async () => {
    const { rows, fetchPage, calls } = makeFetcher(20);
    const out = await paginateAll(fetchPage, 10);
    expect(out).toEqual(rows);
    expect(out).toHaveLength(20);
    expect(calls).toEqual([[0, 9], [10, 19], [20, 29]]);
  });

  it("preserva a ordem das páginas", async () => {
    const { fetchPage } = makeFetcher(25);
    const out = await paginateAll(fetchPage, 10);
    expect(out).toEqual([...Array(25).keys()]);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/supabase/__tests__/paginate.test.ts`
Expected: FAIL — não resolve `@/lib/supabase/paginate` (módulo ainda não existe).

- [ ] **Step 3: Implementar o helper mínimo**

Criar `src/lib/supabase/paginate.ts`:

```ts
/**
 * Busca todas as linhas de uma fonte paginada por offset, contornando o teto
 * de `db-max-rows` (1000) do PostgREST.
 *
 * `fetchPage(from, to)` deve retornar a página `[from, to]` inclusiva e lançar
 * em caso de erro. O laço encerra quando uma página retorna menos que
 * `pageSize` linhas (cobre total múltiplo exato: a próxima página vem vazia).
 */
export async function paginateAll<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const page = await fetchPage(from, from + pageSize - 1);
    all.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/supabase/__tests__/paginate.test.ts`
Expected: PASS — 5 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/paginate.ts src/lib/supabase/__tests__/paginate.test.ts
git commit -m "feat(supabase): paginateAll para contornar teto de 1000 linhas

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `loadRanking` paginado

**Files:**
- Modify: `src/lib/scoring/ranking.ts` (substituir o corpo de `loadRanking`)

> **Nota TDD:** `loadRanking` é `server-only` e bate no Supabase real — não há teste unitário viável sem mock pesado. A correção da paginação está coberta no Task 1; a integração é validada por **verificação manual** (Step 4). A matemática segue coberta por `ranking-core.test.ts`.

- [ ] **Step 1: Substituir o conteúdo de `src/lib/scoring/ranking.ts`**

Reescrever o arquivo inteiro para:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paginateAll } from "@/lib/supabase/paginate";
import {
  aggregate,
  type ProfileRow,
  type ScoreWithStageRow,
  type RankingRow,
} from "./ranking-core";

type ScoreJoinRow = {
  user_id: string;
  points: number;
  tier: string;
  matches: { stage: string } | { stage: string }[];
};

export async function loadRanking(): Promise<RankingRow[]> {
  const supabase = await createClient();

  const [profilesQ, scoreRows] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url, paid"),
    paginateAll<ScoreJoinRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("prediction_scores")
        .select("user_id, points, tier, matches!inner(stage)")
        .order("prediction_id", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as unknown as ScoreJoinRow[];
    }),
  ]);

  if (profilesQ.error) throw profilesQ.error;

  const profiles = (profilesQ.data ?? []) as ProfileRow[];
  const scores: ScoreWithStageRow[] = scoreRows.map((r) => {
    const m = Array.isArray(r.matches) ? r.matches[0] : r.matches;
    return {
      user_id: r.user_id,
      points: r.points,
      tier: r.tier as ScoreWithStageRow["tier"],
      stage: m.stage as ScoreWithStageRow["stage"],
    };
  });

  return aggregate(profiles, scores);
}
```

Pontos a conferir ao colar:
- `.order("prediction_id", ...)` ordena por uma coluna que **não** está no `select` — é permitido no supabase-js e necessário para paginação estável (`prediction_id` é a PK).
- O mapeamento `ScoreJoinRow → ScoreWithStageRow` e a chamada `aggregate(...)` são iguais aos de antes — só a origem das linhas mudou para `paginateAll`.

- [ ] **Step 2: Checar tipos e lint**

Run: `npx tsc --noEmit` e `npm run lint`
Expected: sem erros novos em `src/lib/scoring/ranking.ts`.

- [ ] **Step 3: Rodar a suíte completa**

Run: `npm test`
Expected: PASS — incluindo `paginate.test.ts` (Task 1) e os testes inalterados de `ranking-core`.

- [ ] **Step 4: Verificação manual contra o banco**

1. Subir o app (`npm run dev`) autenticado, ou usar o ambiente já publicado no branch.
2. No SQL editor do Supabase, escolher um participante cujo total estava divergente e rodar:
   ```sql
   select sum(points) from prediction_scores where user_id = '<id>';
   ```
3. Abrir `/classificacao` e comparar o total exibido para o mesmo participante.
4. **Esperado:** os valores batem (ex.: 61 = 61). Antes do fix: 53 ≠ 61.
5. Conferir também que `count(*)` total (1122) corresponde à soma de linhas que o ranking agrega (sem corte em 1000).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/ranking.ts
git commit -m "fix(ranking): paginar leitura de prediction_scores

loadRanking lia a tabela numa unica query e o PostgREST cortava em 1000
linhas, fazendo a classificacao somar a menos. Agora le todas as linhas
via paginateAll com ordenacao estavel por prediction_id.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Definition of Done

- [ ] `paginate.test.ts` verde (5 cenários: vazio, página única curta, não-múltiplo, múltiplo exato, ordem).
- [ ] `npm test` inteiro verde; `npx tsc --noEmit` e `npm run lint` sem erros novos.
- [ ] Verificação manual: total exibido em `/classificacao` == `sum(points)` no banco para participante antes divergente.
- [ ] Sem alterações em `score.ts`, `ranking-core.ts` ou na UI.
