# Palpites — Toggle "Jogos por data" / "Tabela de jogos" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar à tela `/palpites` um toggle entre dois modos de visualização — "Jogos por data" (novo, padrão) e "Tabela de jogos" (atual) — onde os próprios títulos viram botões clicáveis.

**Architecture:** Modo controlado por `searchParams` (`view=date&date=YYYY-MM-DD` vs `stage=...&group=...`). Server component decide o modo, calcula datas em America/Sao_Paulo via `Intl.DateTimeFormat`, e renderiza condicionalmente `<DateNav>` ou `<StageTabs>`. Componentes `MatchPredictionCard` e `GroupSaveForm` ficam intactos.

**Tech Stack:** Next.js 16 (App Router, Server Components), React 19, TypeScript, Tailwind, shadcn/ui, Vitest (`src/**/__tests__/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-06-12-palpites-view-toggle-design.md`

---

## File Structure

```
src/app/(authenticated)/palpites/
├── page.tsx                              (MODIFY)
├── _components/
│   ├── view-toggle.tsx                   (NEW — client, dois títulos botão)
│   ├── date-nav.tsx                      (NEW — client, cards horizontais)
│   ├── stage-tabs.tsx                    (unchanged)
│   ├── match-prediction-card.tsx         (unchanged)
│   └── group-save-form.tsx               (unchanged)
└── _lib/
    ├── queries.ts                        (unchanged)
    ├── date-buckets.ts                   (NEW — utilitário puro)
    └── __tests__/
        └── date-buckets.test.ts          (NEW — testes unitários)
```

Responsabilidades:
- `date-buckets.ts`: conversão de timestamps UTC para datas SP, agrupamento e filtro. Puro, testável, zero deps.
- `view-toggle.tsx`: header com os dois títulos h1 clicáveis. Faz `router.push` para o default do modo oposto.
- `date-nav.tsx`: scroll horizontal de cards de data. Auto-centraliza o ativo no mount.
- `page.tsx`: server component lê `searchParams`, escolhe modo, filtra/ordena, monta o header e os filtros do modo correto.

---

## Task 1: Utilitário `date-buckets.ts` (TDD)

**Files:**
- Create: `src/app/(authenticated)/palpites/_lib/date-buckets.ts`
- Test: `src/app/(authenticated)/palpites/_lib/__tests__/date-buckets.test.ts`

### Contexto

`kickoff_at` no banco é `timestamptz` (UTC). Precisamos converter para data local SP (`YYYY-MM-DD`) usando `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })` — `'en-CA'` retorna direto no formato ISO `YYYY-MM-DD`.

Interface mínima:
```ts
type MatchLike = { id: string; kickoff_at: string };

export function todayInSaoPaulo(now?: Date): string;
export function toSaoPauloDate(kickoffAt: string): string;
export function bucketMatchesByDate<T extends MatchLike>(
  matches: readonly T[]
): Array<{ date: string; count: number }>;
export function filterMatchesByDate<T extends MatchLike>(
  matches: readonly T[],
  date: string
): T[];
```

### Steps

- [ ] **Step 1: Write the failing tests**

Create `src/app/(authenticated)/palpites/_lib/__tests__/date-buckets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  bucketMatchesByDate,
  filterMatchesByDate,
  todayInSaoPaulo,
  toSaoPauloDate,
} from "../date-buckets";

describe("toSaoPauloDate", () => {
  it("retorna a data SP de um timestamp UTC durante o dia", () => {
    // 2026-06-15T18:00:00Z = 15:00 SP (UTC-3)
    expect(toSaoPauloDate("2026-06-15T18:00:00Z")).toBe("2026-06-15");
  });

  it("respeita o dia SP quando UTC já está no dia seguinte", () => {
    // 2026-06-16T02:00:00Z = 23:00 SP do dia 15
    expect(toSaoPauloDate("2026-06-16T02:00:00Z")).toBe("2026-06-15");
  });

  it("respeita o dia SP quando UTC ainda está no dia anterior", () => {
    // 2026-06-15T02:59:00Z = 23:59 SP do dia 14
    expect(toSaoPauloDate("2026-06-15T02:59:00Z")).toBe("2026-06-14");
  });
});

describe("todayInSaoPaulo", () => {
  it("retorna formato YYYY-MM-DD", () => {
    const out = todayInSaoPaulo();
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("usa o `now` injetado", () => {
    expect(todayInSaoPaulo(new Date("2026-06-15T18:00:00Z"))).toBe("2026-06-15");
    expect(todayInSaoPaulo(new Date("2026-06-16T02:00:00Z"))).toBe("2026-06-15");
  });
});

describe("bucketMatchesByDate", () => {
  const matches = [
    { id: "a", kickoff_at: "2026-06-15T18:00:00Z" }, // 15/06 SP
    { id: "b", kickoff_at: "2026-06-15T21:00:00Z" }, // 15/06 SP
    { id: "c", kickoff_at: "2026-06-16T18:00:00Z" }, // 16/06 SP
    { id: "d", kickoff_at: "2026-06-14T22:00:00Z" }, // 14/06 SP
  ];

  it("agrupa por dia SP com contagem", () => {
    expect(bucketMatchesByDate(matches)).toEqual([
      { date: "2026-06-14", count: 1 },
      { date: "2026-06-15", count: 2 },
      { date: "2026-06-16", count: 1 },
    ]);
  });

  it("retorna array vazio sem matches", () => {
    expect(bucketMatchesByDate([])).toEqual([]);
  });
});

describe("filterMatchesByDate", () => {
  const matches = [
    { id: "a", kickoff_at: "2026-06-15T18:00:00Z" },
    { id: "b", kickoff_at: "2026-06-16T02:00:00Z" }, // 23:00 SP do dia 15
    { id: "c", kickoff_at: "2026-06-16T18:00:00Z" },
  ];

  it("retorna matches do dia SP", () => {
    const result = filterMatchesByDate(matches, "2026-06-15").map((m) => m.id);
    expect(result).toEqual(["a", "b"]);
  });

  it("retorna vazio quando não há matches no dia", () => {
    expect(filterMatchesByDate(matches, "2026-06-17")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/app/\(authenticated\)/palpites/_lib/__tests__/date-buckets.test.ts`
Expected: Erro "Cannot find module '../date-buckets'" / FAIL.

- [ ] **Step 3: Implement `date-buckets.ts`**

Create `src/app/(authenticated)/palpites/_lib/date-buckets.ts`:

```ts
const SP_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type MatchLike = { id: string; kickoff_at: string };

export function todayInSaoPaulo(now: Date = new Date()): string {
  return SP_FORMATTER.format(now);
}

export function toSaoPauloDate(kickoffAt: string): string {
  return SP_FORMATTER.format(new Date(kickoffAt));
}

export function bucketMatchesByDate<T extends MatchLike>(
  matches: readonly T[],
): Array<{ date: string; count: number }> {
  const counts = new Map<string, number>();
  for (const m of matches) {
    const d = toSaoPauloDate(m.kickoff_at);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function filterMatchesByDate<T extends MatchLike>(
  matches: readonly T[],
  date: string,
): T[] {
  return matches.filter((m) => toSaoPauloDate(m.kickoff_at) === date);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/app/\(authenticated\)/palpites/_lib/__tests__/date-buckets.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(authenticated\)/palpites/_lib/date-buckets.ts src/app/\(authenticated\)/palpites/_lib/__tests__/date-buckets.test.ts
git commit -m "feat(palpites): utilitário date-buckets para agrupar jogos por dia SP"
```

---

## Task 2: Componente `ViewToggle`

**Files:**
- Create: `src/app/(authenticated)/palpites/_components/view-toggle.tsx`

### Contexto

Dois botões com a mesma tipografia do h1 atual (`font-heading text-4xl sm:text-5xl uppercase tracking-tight`). Active sólido, inactive com `opacity-40 text-muted-foreground cursor-pointer`. Separador `·` discreto. Navegação client-side via `useRouter`.

- [ ] **Step 1: Implement `view-toggle.tsx`**

Create `src/app/(authenticated)/palpites/_components/view-toggle.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type View = "date" | "table";

export function ViewToggle({
  active,
  defaultDate,
}: {
  active: View;
  defaultDate: string;
}) {
  const router = useRouter();

  const goDate = () => router.push(`/palpites?view=date&date=${defaultDate}`);
  const goTable = () => router.push(`/palpites?stage=group&group=A`);

  const titleBase =
    "font-heading text-4xl uppercase tracking-tight sm:text-5xl text-left transition-opacity";
  const activeCls = "text-foreground";
  const inactiveCls = "opacity-40 text-muted-foreground hover:opacity-60 cursor-pointer";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <button
        type="button"
        onClick={goDate}
        aria-pressed={active === "date"}
        className={cn(titleBase, active === "date" ? activeCls : inactiveCls)}
      >
        Jogos por data
      </button>
      <span
        aria-hidden
        className="font-heading text-4xl sm:text-5xl text-muted-foreground/40 select-none"
      >
        ·
      </span>
      <button
        type="button"
        onClick={goTable}
        aria-pressed={active === "table"}
        className={cn(titleBase, active === "table" ? activeCls : inactiveCls)}
      >
        Tabela de jogos
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Smoke check via TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS (sem erros de tipo no arquivo novo).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authenticated\)/palpites/_components/view-toggle.tsx
git commit -m "feat(palpites): componente ViewToggle com dois títulos clicáveis"
```

---

## Task 3: Componente `DateNav`

**Files:**
- Create: `src/app/(authenticated)/palpites/_components/date-nav.tsx`

### Contexto

Scroll horizontal de cards de data. Cada card é `<Link href="/palpites?view=date&date=YYYY-MM-DD">`. Card ativo: `bg-primary text-primary-foreground`; inativo: `border` outline. Linha 1: dia da semana abreviado (pt-BR) + `DD/MM` em fonte mono. Linha 2: `N jogos`. Ao montar, scroll suave para centralizar o ativo.

Formatação de dia da semana: usar `Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' })` aplicado a `new Date(`${date}T12:00:00Z`)` (meio-dia UTC garante que cai no mesmo dia SP).

- [ ] **Step 1: Implement `date-nav.tsx`**

Create `src/app/(authenticated)/palpites/_components/date-nav.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Bucket = { date: string; count: number };

const WEEKDAY_FMT = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  timeZone: "America/Sao_Paulo",
});

function formatLabels(date: string): { weekday: string; dayMonth: string } {
  // date é YYYY-MM-DD; usamos meio-dia UTC para evitar drift em SP (UTC-3).
  const d = new Date(`${date}T12:00:00Z`);
  const weekday = WEEKDAY_FMT.format(d).replace(".", "");
  const [, mm, dd] = date.split("-");
  return { weekday, dayMonth: `${dd}/${mm}` };
}

export function DateNav({
  buckets,
  active,
}: {
  buckets: Bucket[];
  active: string;
}) {
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "instant" as ScrollBehavior,
    });
  }, [active]);

  if (buckets.length === 0) return null;

  return (
    <div className="-mx-1 mb-6 overflow-x-auto px-1 pb-1">
      <div className="flex gap-2">
        {buckets.map((b) => {
          const isActive = b.date === active;
          const { weekday, dayMonth } = formatLabels(b.date);
          return (
            <Link
              key={b.date}
              ref={isActive ? activeRef : undefined}
              href={`/palpites?view=date&date=${b.date}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-28 shrink-0 flex-col items-center rounded-lg border px-3 py-2 text-center transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              <span className="text-xs font-medium uppercase">
                {weekday} <span className="font-mono">{dayMonth}</span>
              </span>
              <span
                className={cn(
                  "mt-1 text-xs",
                  isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {b.count} {b.count === 1 ? "jogo" : "jogos"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke check via TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authenticated\)/palpites/_components/date-nav.tsx
git commit -m "feat(palpites): componente DateNav com scroll horizontal de cards de data"
```

---

## Task 4: Integrar na `page.tsx`

**Files:**
- Modify: `src/app/(authenticated)/palpites/page.tsx`

### Contexto

Atualizar o server component para:
1. Aceitar `view` e `date` em `searchParams`.
2. Decidir modo: `view=date` se `view==="date"` OU se nenhum de `view`/`stage` foi passado.
3. No modo "date": calcular `buckets` a partir de **todos** os matches, filtrar pelo dia, ordenar por horário.
4. No modo "table": comportamento atual intacto.
5. Substituir o `<h1>` por `<ViewToggle>` e o `<StageTabs>` por `<DateNav>` quando aplicável.
6. Empty states: mensagem diferente quando "data sem jogos" vs "nenhum jogo cadastrado".

- [ ] **Step 1: Reescrever `page.tsx`**

Substituir o conteúdo de `src/app/(authenticated)/palpites/page.tsx` por:

```tsx
import Image from "next/image";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { STAGES, type Stage } from "@/lib/types/match";
import { StageTabs } from "./_components/stage-tabs";
import { MatchPredictionCard } from "./_components/match-prediction-card";
import { GroupSaveForm } from "./_components/group-save-form";
import { ViewToggle } from "./_components/view-toggle";
import { DateNav } from "./_components/date-nav";
import { getMatchesWithPredictions } from "./_lib/queries";
import {
  bucketMatchesByDate,
  filterMatchesByDate,
  todayInSaoPaulo,
} from "./_lib/date-buckets";

type View = "date" | "table";

export default async function PalpitesPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    date?: string;
    stage?: string;
    group?: string;
  }>;
}) {
  const sp = await searchParams;

  const view: View =
    sp.view === "date" || (!sp.view && !sp.stage) ? "date" : "table";

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const all = await getMatchesWithPredictions(supabase, userData.user.id);

  const today = todayInSaoPaulo();
  let filtered: typeof all;
  let dateBuckets: Array<{ date: string; count: number }> = [];
  let selectedDate = today;
  let stage: Stage = "group";
  let groupCode: string | undefined;

  if (view === "date") {
    dateBuckets = bucketMatchesByDate(all);
    selectedDate = sp.date ?? today;
    filtered = filterMatchesByDate(all, selectedDate).sort((a, b) =>
      a.kickoff_at.localeCompare(b.kickoff_at),
    );
  } else {
    stage = (STAGES as readonly string[]).includes(sp.stage ?? "")
      ? (sp.stage as Stage)
      : "group";
    groupCode = stage === "group" ? (sp.group ?? "A") : undefined;
    filtered = all.filter((m) => {
      if (m.stage !== stage) return false;
      if (stage === "group") return m.group_code === groupCode;
      return true;
    });
  }

  const savedCount = filtered.filter((m) => m.prediction !== null).length;
  const totalPts = filtered.reduce(
    (acc, m) => acc + (m.score?.points ?? 0),
    0,
  );

  const noMatchesAtAll = all.length === 0;
  const noMatchesForDate = view === "date" && !noMatchesAtAll && filtered.length === 0;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Seus palpites
          </p>
          <ViewToggle active={view} defaultDate={today} />
          <p className="text-muted-foreground">Faça seus palpites.</p>
        </div>
        {filtered.length > 0 ? (
          <Badge variant="secondary" className="h-7 px-3 text-xs">
            {savedCount}/{filtered.length} palpites · {totalPts} pts
          </Badge>
        ) : null}
      </header>

      {view === "date" ? (
        <DateNav buckets={dateBuckets} active={selectedDate} />
      ) : (
        <StageTabs current={stage} groupCode={groupCode} />
      )}

      {noMatchesAtAll ? (
        <Card className="border-2 border-foreground/10">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <Image
              src="/BISTECA.png"
              alt=""
              width={120}
              height={154}
              className="h-28 w-auto opacity-80"
            />
            <p className="font-heading text-2xl uppercase tracking-wide">
              Nenhum jogo no forno
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Os jogos aparecem aqui assim que a tabela da Copa 2026 for
              publicada. Volte logo.
            </p>
          </CardContent>
        </Card>
      ) : noMatchesForDate ? (
        <Card className="border-2 border-foreground/10">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <p className="font-heading text-2xl uppercase tracking-wide">
              Nenhum jogo neste dia
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Escolha outra data acima.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-2 border-foreground/10">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <p className="font-heading text-2xl uppercase tracking-wide">
              Nenhum jogo nesta fase
            </p>
          </CardContent>
        </Card>
      ) : (
        <GroupSaveForm>
          <div className="grid gap-3">
            {filtered.map((m) => (
              <MatchPredictionCard key={m.id} match={m} />
            ))}
          </div>
        </GroupSaveForm>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Smoke check via TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Rodar suíte de testes**

Run: `npm test`
Expected: Todos os testes verdes (incluindo `date-buckets.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/palpites/page.tsx
git commit -m "feat(palpites): toggle Jogos por data / Tabela de jogos com data padrão hoje"
```

---

## Task 5: Validação manual no browser

**Files:** nenhum (apenas validação).

- [ ] **Step 1: Subir o dev server**

Run: `npm run dev`

- [ ] **Step 2: Checar os fluxos**

Para cada item, abrir a URL, observar resultado, marcar:

- [ ] `/palpites` (sem query) → header mostra "Jogos por data" ativo + "Tabela de jogos" esmaecido; DateNav aparece; data de hoje destacada e centralizada no scroll.
- [ ] Clicar em "Tabela de jogos" → URL vira `?stage=group&group=A`; StageTabs + chips de grupo voltam.
- [ ] Clicar em "Jogos por data" de volta → URL `?view=date&date=<hoje>`; DateNav volta.
- [ ] `/palpites?view=date&date=2099-12-31` (data sem jogos) → empty state "Nenhum jogo neste dia / Escolha outra data acima."; DateNav continua visível.
- [ ] Clicar em outra data no DateNav → URL atualiza, lista de jogos da nova data renderiza, card ativo centraliza.
- [ ] Salvar palpite via botão sticky → toast de sucesso; recarregar a página mantém o palpite (badge `savedCount/total` reflete).
- [ ] DevTools mobile (375px): títulos quebram em 2 linhas; DateNav rola horizontalmente; card ativo permanece visível.

- [ ] **Step 3: Sem commit (apenas validação)**

---

## Plano completo

Total: 5 tasks. Cada uma é independente e commitável.
