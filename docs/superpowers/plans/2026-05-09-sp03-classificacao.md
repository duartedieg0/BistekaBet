# SP-03 Classificação com Desempate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar classificação geral do bolão com todos os 6 critérios de desempate (§12), em duas superfícies — top-10 em `/inicio#ranking` e tabela completa em `/classificacao`.

**Architecture:** Server Component RSC chama `loadRanking()` que lê `profiles` + `prediction_scores ⨝ matches`, agrega em TS via `aggregate()` puro e ordena por `compareForRanking()` espelhando §12 literalmente. Empates remanescentes compartilham `rank` (1, 2, 2, 4). Sem novos objetos no banco além de uma policy de SELECT pública em `profiles`.

**Tech Stack:** Next.js 16 RSC · Supabase (FK join) · vitest · shadcn (Table, Badge) · TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-09-sp03-classificacao-design.md`
**Plano macro:** `docs/superpowers/specs/2026-05-09-plano-macro-regulamento.md`
**Depende de:** SP-01 (engine) e SP-02 (`prediction_scores` aplicada).

**Notas para o executor:**
- npm. TypeScript strict. Vitest configurado.
- Migrações SQL aplicadas **manualmente** no Supabase Studio.
- shadcn primitives já existentes: `Table`, `Badge`, `Card`. Não criar.
- Header tem dois arquivos com o link "Ranking": `app-sidebar.tsx` e `auth-header.tsx`.
- Após SP-02: `profiles` tem coluna `paid`, `prediction_scores` existe com FK para `matches`.
- Não criar página pública sem login. A rota é `(authenticated)/classificacao`.

---

## File Structure

**Criar:**
- `supabase/sql/009_profiles_public_read.sql` — policy pública de SELECT em `profiles`.
- `src/lib/scoring/ranking-core.ts` — tipos + `compareForRanking` + `assignRanks` + `aggregate`.
- `src/lib/scoring/ranking.ts` — `loadRanking()` com Supabase server client.
- `src/lib/scoring/__tests__/ranking-core.test.ts`.
- `src/app/(authenticated)/inicio/_components/ranking-table.tsx`.
- `src/app/(authenticated)/inicio/_components/ranking-preview.tsx`.
- `src/app/(authenticated)/classificacao/page.tsx`.

**Modificar:**
- `src/app/(authenticated)/inicio/page.tsx` — incluir `<RankingPreview />`.
- `src/app/(authenticated)/_components/app-sidebar.tsx` — href `/inicio#ranking` → `/classificacao`.
- `src/app/(authenticated)/_components/auth-header.tsx` — idem.
- `src/app/(authenticated)/admin/partidas/_actions.ts` — `revalidatePath("/inicio")` + `revalidatePath("/classificacao")`.
- `src/app/(authenticated)/admin/_actions.ts` — `revalidatePath("/inicio")` + `revalidatePath("/classificacao")`.

---

## Task 1: Migração SQL — leitura pública de `profiles`

**Files:**
- Create: `supabase/sql/009_profiles_public_read.sql`

- [ ] **Step 1: Criar arquivo de migração**

Conteúdo:

```sql
-- BistekaBet — leitura pública de profiles entre autenticados (SP-03)
-- A classificação precisa exibir display_name, avatar_url e paid de todos.
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
```

- [ ] **Step 2: Aplicar no Supabase Studio**

Studio → SQL Editor → colar → Run.

- [ ] **Step 3: Smoke test**

Como qualquer usuário autenticado:

```sql
select count(*) from public.profiles;
```

Esperado: número total de perfis (não apenas o próprio).

- [ ] **Step 4: Commit**

```bash
git add supabase/sql/009_profiles_public_read.sql
git commit -m "feat(db): public read policy on profiles for ranking"
```

---

## Task 2: Núcleo puro `ranking-core.ts` (TDD)

**Files:**
- Test: `src/lib/scoring/__tests__/ranking-core.test.ts`
- Create: `src/lib/scoring/ranking-core.ts`

- [ ] **Step 1: Escrever os testes falhos**

Criar `src/lib/scoring/__tests__/ranking-core.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  aggregate,
  compareForRanking,
  assignRanks,
  type ProfileRow,
  type ScoreWithStageRow,
  type RankingEntry,
} from "@/lib/scoring/ranking-core";

const profile = (id: string, name = id, paid = true): ProfileRow => ({
  id, display_name: name, avatar_url: null, paid,
});

const s = (user_id: string, points: number, tier: "exact" | "winner_or_draw" | "miss", stage: ScoreWithStageRow["stage"]): ScoreWithStageRow =>
  ({ user_id, points, tier, stage });

const baseEntry = (over: Partial<RankingEntry> = {}): RankingEntry => ({
  user_id: "x",
  display_name: "X",
  avatar_url: null,
  paid: true,
  total_points: 0,
  exacts_total: 0,
  exacts_knockout: 0,
  winner_or_draw_total: 0,
  final_points: 0,
  semi_third_final_points: 0,
  ...over,
});

describe("aggregate", () => {
  it("sem scores → todos os perfis aparecem zerados (§3, §11)", () => {
    const r = aggregate([profile("u1"), profile("u2")], []);
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.total_points === 0)).toBe(true);
    expect(r.map((x) => x.rank)).toEqual([1, 1]);
  });

  it("ordena desc por total_points (§11)", () => {
    const r = aggregate(
      [profile("a"), profile("b"), profile("c")],
      [s("a", 7, "exact", "group"), s("b", 4, "winner_or_draw", "group")],
    );
    expect(r.map((x) => x.user_id)).toEqual(["a", "b", "c"]);
  });

  it("score órfão (user sem profile) é ignorado", () => {
    const r = aggregate([profile("a")], [s("ghost", 7, "exact", "group")]);
    expect(r).toHaveLength(1);
    expect(r[0].total_points).toBe(0);
  });

  it("contabiliza exacts_total, exacts_knockout, winner_or_draw_total, final_points, semi_third_final_points", () => {
    const r = aggregate([profile("a")], [
      s("a", 7,  "exact",          "group"),
      s("a", 13, "exact",          "round_of_16"),
      s("a", 4,  "winner_or_draw", "group"),
      s("a", 0,  "miss",           "group"),
      s("a", 25, "exact",          "semi"),
      s("a", 22, "exact",          "third_place"),
      s("a", 34, "exact",          "final"),
    ]);
    const a = r[0];
    expect(a.total_points).toBe(7 + 13 + 4 + 0 + 25 + 22 + 34);
    expect(a.exacts_total).toBe(5);
    expect(a.exacts_knockout).toBe(4);              // round_of_16, semi, third_place, final
    expect(a.winner_or_draw_total).toBe(6);         // tudo que não é miss
    expect(a.final_points).toBe(34);
    expect(a.semi_third_final_points).toBe(25 + 22 + 34);
  });
});

describe("compareForRanking — §12 critérios em cascata", () => {
  it("§12.1: empate em total → mais exacts_total vence", () => {
    const a = baseEntry({ user_id: "a", total_points: 10, exacts_total: 2 });
    const b = baseEntry({ user_id: "b", total_points: 10, exacts_total: 1 });
    expect(compareForRanking(a, b)).toBeLessThan(0);
  });

  it("§12.2: empate em §12.1 → mais exacts_knockout vence", () => {
    const a = baseEntry({ total_points: 10, exacts_total: 2, exacts_knockout: 2 });
    const b = baseEntry({ total_points: 10, exacts_total: 2, exacts_knockout: 1 });
    expect(compareForRanking(a, b)).toBeLessThan(0);
  });

  it("§12.3: empate em §12.2 → mais winner_or_draw_total vence", () => {
    const a = baseEntry({ total_points: 10, exacts_total: 2, exacts_knockout: 1, winner_or_draw_total: 5 });
    const b = baseEntry({ total_points: 10, exacts_total: 2, exacts_knockout: 1, winner_or_draw_total: 4 });
    expect(compareForRanking(a, b)).toBeLessThan(0);
  });

  it("§12.4: empate em §12.3 → mais final_points vence", () => {
    const a = baseEntry({ total_points: 10, exacts_total: 0, exacts_knockout: 0, winner_or_draw_total: 5, final_points: 25 });
    const b = baseEntry({ total_points: 10, exacts_total: 0, exacts_knockout: 0, winner_or_draw_total: 5, final_points: 11 });
    expect(compareForRanking(a, b)).toBeLessThan(0);
  });

  it("§12.5: empate em §12.4 → mais semi_third_final_points vence", () => {
    const a = baseEntry({ total_points: 10, exacts_total: 0, exacts_knockout: 0, winner_or_draw_total: 5, final_points: 0, semi_third_final_points: 30 });
    const b = baseEntry({ total_points: 10, exacts_total: 0, exacts_knockout: 0, winner_or_draw_total: 5, final_points: 0, semi_third_final_points: 15 });
    expect(compareForRanking(a, b)).toBeLessThan(0);
  });

  it("§12.6: empate em todos os critérios → 0 (sorteio externo)", () => {
    const a = baseEntry({ user_id: "a" });
    const b = baseEntry({ user_id: "b" });
    expect(compareForRanking(a, b)).toBe(0);
  });
});

describe("assignRanks", () => {
  it("empates compartilham rank (1, 2, 2, 4)", () => {
    const sorted: RankingEntry[] = [
      baseEntry({ user_id: "a", total_points: 10 }),
      baseEntry({ user_id: "b", total_points: 5 }),
      baseEntry({ user_id: "c", total_points: 5 }),
      baseEntry({ user_id: "d", total_points: 1 }),
    ];
    const r = assignRanks(sorted);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 2, 4]);
  });

  it("KNOCKOUT_STAGES não inclui group (§12 último parágrafo)", () => {
    const r = aggregate([profile("a")], [
      s("a", 7, "exact", "group"),
      s("a", 7, "exact", "round_of_32"),
    ]);
    expect(r[0].exacts_total).toBe(2);
    expect(r[0].exacts_knockout).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test`
Expected: testes de `ranking-core.test.ts` falham com module-not-found.

- [ ] **Step 3: Implementar `ranking-core.ts`**

Criar `src/lib/scoring/ranking-core.ts`:

```ts
import type { Stage } from "@/lib/types/match";
import type { Tier } from "@/lib/scoring";

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  paid: boolean;
};

export type ScoreWithStageRow = {
  user_id: string;
  points: number;
  tier: Tier;
  stage: Stage;
};

export type RankingEntry = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  paid: boolean;
  total_points: number;
  exacts_total: number;
  exacts_knockout: number;
  winner_or_draw_total: number;
  final_points: number;
  semi_third_final_points: number;
};

export type RankingRow = RankingEntry & { rank: number };

const KNOCKOUT_STAGES: ReadonlySet<Stage> = new Set<Stage>([
  "round_of_32", "round_of_16", "quarter", "semi", "third_place", "final",
]);

const SEMI_THIRD_FINAL: ReadonlySet<Stage> = new Set<Stage>([
  "semi", "third_place", "final",
]);

export function compareForRanking(a: RankingEntry, b: RankingEntry): number {
  if (a.total_points !== b.total_points) return b.total_points - a.total_points;
  if (a.exacts_total !== b.exacts_total) return b.exacts_total - a.exacts_total;
  if (a.exacts_knockout !== b.exacts_knockout) return b.exacts_knockout - a.exacts_knockout;
  if (a.winner_or_draw_total !== b.winner_or_draw_total)
    return b.winner_or_draw_total - a.winner_or_draw_total;
  if (a.final_points !== b.final_points) return b.final_points - a.final_points;
  if (a.semi_third_final_points !== b.semi_third_final_points)
    return b.semi_third_final_points - a.semi_third_final_points;
  return 0;
}

export function assignRanks(sorted: RankingEntry[]): RankingRow[] {
  const result: RankingRow[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const prev = result[i - 1];
    const tied = prev !== undefined && compareForRanking(sorted[i], sorted[i - 1]) === 0;
    result.push({ ...sorted[i], rank: tied ? prev.rank : i + 1 });
  }
  return result;
}

export function aggregate(
  profiles: ProfileRow[],
  scores: ScoreWithStageRow[],
): RankingRow[] {
  const init = new Map<string, RankingEntry>();
  for (const p of profiles) {
    init.set(p.id, {
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
    });
  }

  for (const sc of scores) {
    const entry = init.get(sc.user_id);
    if (!entry) continue;

    entry.total_points += sc.points;
    if (sc.tier === "exact") {
      entry.exacts_total += 1;
      if (KNOCKOUT_STAGES.has(sc.stage)) entry.exacts_knockout += 1;
    }
    if (sc.tier !== "miss") entry.winner_or_draw_total += 1;
    if (sc.stage === "final") entry.final_points += sc.points;
    if (SEMI_THIRD_FINAL.has(sc.stage)) entry.semi_third_final_points += sc.points;
  }

  const sorted = [...init.values()].sort(compareForRanking);
  return assignRanks(sorted);
}
```

- [ ] **Step 4: Rodar testes**

Run: `npm test`
Expected: 65 (anteriores) + 11 novos = **76 tests passing**.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring/ranking-core.ts src/lib/scoring/__tests__/ranking-core.test.ts
git commit -m "feat(scoring): pure ranking aggregation with §12 tiebreakers"
```

---

## Task 3: I/O `loadRanking()`

**Files:**
- Create: `src/lib/scoring/ranking.ts`

- [ ] **Step 1: Criar arquivo**

Conteúdo:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
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

  const [profilesQ, scoresQ] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url, paid"),
    supabase
      .from("prediction_scores")
      .select("user_id, points, tier, matches!inner(stage)"),
  ]);

  if (profilesQ.error) throw profilesQ.error;
  if (scoresQ.error) throw scoresQ.error;

  const profiles = (profilesQ.data ?? []) as ProfileRow[];
  const scores: ScoreWithStageRow[] = ((scoresQ.data ?? []) as ScoreJoinRow[]).map((r) => {
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

- [ ] **Step 2: Smoke test do `matches!inner(stage)` (sintaxe do PostgREST)**

Em desenvolvimento: `npm run dev`, criar uma rota temporária de teste OU adicionar `console.log` na ranking-page após implementada (Task 5/6) para confirmar que o array de scores carregado tem `stage` populado.

Se a sintaxe falhar com erro tipo "could not find foreign key" ou retornar array vazio com FK existente, o **fallback** é fazer dois reads e juntar em memória:

```ts
// fallback (se matches!inner não funcionar)
const [profilesQ, scoresQ, matchesQ] = await Promise.all([
  supabase.from("profiles").select("id, display_name, avatar_url, paid"),
  supabase.from("prediction_scores").select("user_id, points, tier, match_id"),
  supabase.from("matches").select("id, stage"),
]);
const stageById = new Map((matchesQ.data ?? []).map((m: { id: string; stage: string }) => [m.id, m.stage]));
const scores: ScoreWithStageRow[] = (scoresQ.data ?? []).map((r: { user_id: string; points: number; tier: string; match_id: string }) => ({
  user_id: r.user_id,
  points: r.points,
  tier: r.tier as ScoreWithStageRow["tier"],
  stage: stageById.get(r.match_id) as ScoreWithStageRow["stage"],
})).filter((s) => s.stage !== undefined);
```

(O smoke test ocorre nas tasks 5/6 quando a página renderizar.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo.

- [ ] **Step 4: Commit**

```bash
git add src/lib/scoring/ranking.ts
git commit -m "feat(scoring): loadRanking server-side I/O"
```

---

## Task 4: `RankingTable` component

**Files:**
- Create: `src/app/(authenticated)/inicio/_components/ranking-table.tsx`

- [ ] **Step 1: Criar componente**

Conteúdo:

```tsx
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RankingRow } from "@/lib/scoring/ranking-core";

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        A classificação aparecerá aqui assim que os primeiros resultados forem
        registrados.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-right">#</TableHead>
          <TableHead>Participante</TableHead>
          <TableHead className="w-24 text-center">Status</TableHead>
          <TableHead className="w-20 text-right">Pontos</TableHead>
          <TableHead className="w-20 text-right">Exatos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.user_id}>
            <TableCell className="text-right font-semibold tabular-nums">
              {r.rank}
            </TableCell>
            <TableCell className="font-medium">{r.display_name}</TableCell>
            <TableCell className="text-center">
              {r.paid ? (
                <Badge>Pago</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Pendente
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.total_points}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.exacts_total}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo. Se `Badge` não tiver variant `default` (sem prop), confirme que renderiza com a variant primária do projeto. Caso contrário, ajustar para o variant correto observado em `src/app/(authenticated)/admin/usuarios/page.tsx` ou similar.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authenticated\)/inicio/_components/ranking-table.tsx
git commit -m "feat(ranking): RankingTable component"
```

---

## Task 5: `RankingPreview` (top-10 em `/inicio#ranking`)

**Files:**
- Create: `src/app/(authenticated)/inicio/_components/ranking-preview.tsx`

- [ ] **Step 1: Criar componente**

Conteúdo:

```tsx
import Link from "next/link";
import { loadRanking } from "@/lib/scoring/ranking";
import { RankingTable } from "./ranking-table";

export async function RankingPreview() {
  const rows = await loadRanking();
  const top10 = rows.slice(0, 10);

  return (
    <section id="ranking" className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-4">
        <h2 className="font-heading text-3xl tracking-wide">Ranking</h2>
        <Link
          href="/classificacao"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Ver classificação completa →
        </Link>
      </header>
      <RankingTable rows={top10} />
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authenticated\)/inicio/_components/ranking-preview.tsx
git commit -m "feat(ranking): RankingPreview top-10 server component"
```

---

## Task 6: Inserir `<RankingPreview />` na página `/inicio`

**Files:**
- Modify: `src/app/(authenticated)/inicio/page.tsx`

- [ ] **Step 1: Importar e renderizar**

No topo, junto aos demais imports:

```tsx
import { RankingPreview } from "./_components/ranking-preview";
```

Trocar a função para `async` (RSC com `await` no filho compõe sem mudar a página, mas se a página atual renderizar diretamente o componente, ela precisa ser async para SSR. Como `RankingPreview` é um RSC `async`, **não** é necessário await na página — basta renderizar `<RankingPreview />` como JSX, que é como Next 16 lida com server async children.)

Adicionar uma `<section>` ao final do `<main>` (depois do bloco `<section className="grid gap-5 lg:grid-cols-[2fr_1fr]">`), com margem superior:

```tsx
<section className="mt-10">
  <RankingPreview />
</section>
```

- [ ] **Step 2: Typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Expected: build passa.

- [ ] **Step 3: Smoke manual (dev)**

Run: `npm run dev`
Acessar `/inicio` logado. Conferir:
- Seção "Ranking" aparece abaixo das outras.
- Sem palpites pontuados ainda, mostra mensagem "A classificação aparecerá aqui...".
- Após aplicar resultados (SP-02), aparecem rows com pontos.
- Anchor `/inicio#ranking` rola até a seção.
- Console **server-side** sem erros do tipo "could not find foreign key" no log do dev (caso ocorra, aplicar fallback descrito na Task 3 Step 2).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/inicio/page.tsx
git commit -m "feat(inicio): show top-10 ranking section"
```

---

## Task 7: Página dedicada `/classificacao`

**Files:**
- Create: `src/app/(authenticated)/classificacao/page.tsx`

- [ ] **Step 1: Criar a página**

Conteúdo:

```tsx
import { loadRanking } from "@/lib/scoring/ranking";
import { RankingTable } from "@/app/(authenticated)/inicio/_components/ranking-table";

export default async function ClassificacaoPage() {
  const rows = await loadRanking();

  return (
    <main className="container mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Bolão Copa 2026
        </p>
        <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
          Classificação
        </h1>
        <p className="text-muted-foreground">
          {rows.length} {rows.length === 1 ? "participante" : "participantes"}.
          Atualizada conforme resultados oficiais são registrados.
        </p>
      </header>
      <RankingTable rows={rows} />
    </main>
  );
}
```

- [ ] **Step 2: Typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Expected: rota `/classificacao` aparece no output do build.

- [ ] **Step 3: Smoke manual**

Acessar `/classificacao`. Conferir tabela completa.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/classificacao/page.tsx
git commit -m "feat(ranking): full /classificacao page"
```

---

## Task 8: Atualizar links do header

**Files:**
- Modify: `src/app/(authenticated)/_components/app-sidebar.tsx`
- Modify: `src/app/(authenticated)/_components/auth-header.tsx`

- [ ] **Step 1: Trocar href em `app-sidebar.tsx`**

Linha:
```ts
{ href: "/inicio#ranking", label: "Ranking", icon: Trophy },
```
Vira:
```ts
{ href: "/classificacao", label: "Ranking", icon: Trophy },
```

- [ ] **Step 2: Trocar href em `auth-header.tsx`**

Linha:
```ts
{ href: "/inicio#ranking", label: "Ranking" },
```
Vira:
```ts
{ href: "/classificacao", label: "Ranking" },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/_components/app-sidebar.tsx src/app/\(authenticated\)/_components/auth-header.tsx
git commit -m "feat(header): point Ranking nav to /classificacao"
```

---

## Task 9: `revalidatePath` em fluxos administrativos

**Files:**
- Modify: `src/app/(authenticated)/admin/partidas/_actions.ts`
- Modify: `src/app/(authenticated)/admin/_actions.ts`

- [ ] **Step 1: Em `partidas/_actions.ts`, dentro de `updateMatch`**

Após a chamada existente a `recomputeMatchScores(matchId)` e antes do `redirect`, ao lado dos `revalidatePath` já existentes para `/admin/partidas`, adicionar:

```ts
revalidatePath("/inicio");
revalidatePath("/classificacao");
```

Bloco final:
```ts
await recomputeMatchScores(matchId);
revalidatePath("/admin/partidas");
revalidatePath(`/admin/partidas/${matchId}`);
revalidatePath("/inicio");
revalidatePath("/classificacao");
redirect("/admin/partidas");
```

- [ ] **Step 2: Em `admin/_actions.ts`, dentro de `recomputeAllScores`**

Antes de `return ...`, ao lado do `revalidatePath("/admin")` existente, adicionar:

```ts
revalidatePath("/inicio");
revalidatePath("/classificacao");
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/admin/partidas/_actions.ts src/app/\(authenticated\)/admin/_actions.ts
git commit -m "feat(admin): revalidate ranking pages on score changes"
```

---

## Task 10: Verificação final

**Files:** nenhum (apenas validação).

- [ ] **Step 1: Suíte de testes completa**

Run: `npm test`
Expected: ≥ 76 tests verdes (65 anteriores + 11 novos).

- [ ] **Step 2: Typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: typecheck limpo. Lint sem **novos** erros em arquivos do SP-03 (erros pré-existentes em `hero.tsx` e `match-prediction-card.tsx` permanecem fora do escopo).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build OK; rota `/classificacao` listada.

- [ ] **Step 4: Smoke E2E manual**

Pré-requisito: SP-02 aplicada e ao menos um match com resultado salvo (`prediction_scores` populada).

1. Logar como admin → ir em `/admin` → clicar "Recalcular pontuações" → toast com totais.
2. Acessar `/classificacao` → tabela aparece com participantes ordenados.
3. Acessar `/inicio` → seção "Ranking" abaixo dos cards principais, top-10 visível, link "Ver classificação completa" navega para `/classificacao`.
4. Item "Ranking" do header/sidebar leva direto para `/classificacao`.
5. Logar como usuário comum → mesma navegação funciona; conseguir ver lista de todos.
6. Empate forçado (manualmente no Studio: dois usuários com mesmos pontos): conferir que `rank` é compartilhado (`1, 2, 2, 4`).
7. Após salvar resultado novo no admin, revalidação refletiu em `/inicio` e `/classificacao` (hard refresh ou navegação fresca).

- [ ] **Step 5: Confirmar fonte de FK funcionando**

No log do `npm run dev` durante o smoke, verificar que **não houve** erro do PostgREST sobre FK em `matches!inner(stage)`. Se houve, aplicar fallback descrito na Task 3 Step 2 e reabrir Task 3.

---

## Done criteria

- [x] Policy `profiles_select_authenticated` aplicada em produção.
- [x] `aggregate`, `compareForRanking`, `assignRanks` implementadas e testadas (≥ 11 testes).
- [x] §12 critérios 1–6 cobertos por testes nomeados pela cláusula.
- [x] `loadRanking` lê `profiles` + `prediction_scores ⨝ matches`.
- [x] `/inicio#ranking` mostra top-10.
- [x] `/classificacao` mostra todos os participantes.
- [x] Header aponta para `/classificacao`.
- [x] `revalidatePath` em `updateMatch` e `recomputeAllScores`.
- [x] `npm test`, `npx tsc --noEmit`, `npm run build` passam.
- [x] Verificação E2E manual concluída.
