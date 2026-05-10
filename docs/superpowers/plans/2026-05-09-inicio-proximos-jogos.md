# Página /inicio — Bloco "Seus próximos jogos" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o card mockado "Seus próximos jogos" em `/inicio` por um bloco real com duas abas — "Próximos jogos" (jogos do dia em fuso `America/Sao_Paulo`, com palpite) e "Jogos ao vivo" (mock).

**Architecture:** Server component busca matches do dia (com fallback para o próximo dia com jogos) usando um helper isolado de fuso. Client component controla as abas e default dinâmico. `MatchPredictionCard` da rota `/palpites` é reutilizado tal qual; mock de "ao vivo" é client-only com shape pronto para integração futura.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Supabase, Tailwind, shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-09-inicio-proximos-jogos-design.md`

---

## File Structure

**Criar:**
- `src/lib/dates/sao-paulo-day.ts` — helpers `saoPauloDayRange` e `formatSaoPauloDayLabel`.
- `src/lib/dates/__tests__/sao-paulo-day.test.ts` — testes unitários.
- `src/app/(authenticated)/inicio/_lib/queries.ts` — `getMatchesForDayWithPredictions` (busca por range UTC) e `getNextDayWithMatches` (próximo dia com jogos em SP).
- `src/app/(authenticated)/inicio/_components/upcoming-matches-section.tsx` — server component que orquestra fetch + render.
- `src/app/(authenticated)/inicio/_components/inicio-matches-tabs.tsx` — client component com `Tabs` shadcn e default dinâmico.
- `src/app/(authenticated)/inicio/_components/upcoming-matches-list.tsx` — render dos cards do dia (lado client é desnecessário; pode ser server).
- `src/app/(authenticated)/inicio/_components/live-matches-mock.tsx` — client component com mock de jogos ao vivo.

**Modificar:**
- `src/app/(authenticated)/inicio/page.tsx` — remover o Card antigo e substituir pelo `UpcomingMatchesSection`.

---

## Task 1: Helper de fuso `America/Sao_Paulo`

**Files:**
- Create: `src/lib/dates/sao-paulo-day.ts`
- Test: `src/lib/dates/__tests__/sao-paulo-day.test.ts`

- [ ] **Step 1.1: Escrever testes (failing)**

`src/lib/dates/__tests__/sao-paulo-day.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  saoPauloDayRange,
  formatSaoPauloDayLabel,
} from "@/lib/dates/sao-paulo-day";

describe("saoPauloDayRange", () => {
  it("retorna início e fim do dia em SP convertidos para UTC", () => {
    // 12 jun 2026 14:00 UTC === 11:00 em SP (UTC-3)
    const ref = new Date("2026-06-12T14:00:00Z");
    const { startUtc, endUtc } = saoPauloDayRange(ref);
    // 12 jun 2026 00:00 SP === 03:00 UTC
    expect(startUtc.toISOString()).toBe("2026-06-12T03:00:00.000Z");
    // 13 jun 2026 00:00 SP === 03:00 UTC
    expect(endUtc.toISOString()).toBe("2026-06-13T03:00:00.000Z");
  });

  it("01:00 UTC ainda é 'ontem' em SP — range é o dia anterior em SP", () => {
    // 12 jun 2026 01:00 UTC === 11 jun 22:00 em SP
    const ref = new Date("2026-06-12T01:00:00Z");
    const { startUtc, endUtc } = saoPauloDayRange(ref);
    expect(startUtc.toISOString()).toBe("2026-06-11T03:00:00.000Z");
    expect(endUtc.toISOString()).toBe("2026-06-12T03:00:00.000Z");
  });

  it("range tem exatamente 24h", () => {
    const { startUtc, endUtc } = saoPauloDayRange(new Date("2026-06-12T14:00:00Z"));
    expect(endUtc.getTime() - startUtc.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("formatSaoPauloDayLabel", () => {
  it("retorna 'Hoje · 12 jun' quando isToday=true", () => {
    const d = new Date("2026-06-12T14:00:00Z");
    expect(formatSaoPauloDayLabel(d, { isToday: true })).toBe("Hoje · 12 jun");
  });

  it("retorna formato curto 'sex, 12 jun' quando isToday=false", () => {
    const d = new Date("2026-06-12T14:00:00Z");
    expect(formatSaoPauloDayLabel(d, { isToday: false })).toBe("sex, 12 jun");
  });
});
```

- [ ] **Step 1.2: Rodar testes — esperar falha**

```bash
npx vitest run src/lib/dates/__tests__/sao-paulo-day.test.ts
```

Expected: FAIL (módulo inexistente).

- [ ] **Step 1.3: Implementar helper**

`src/lib/dates/sao-paulo-day.ts`:

```ts
const TZ = "America/Sao_Paulo";

function saoPauloYmd(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function utcMidnightOfSaoPauloDay(y: number, m: number, d: number): Date {
  // Brasil sem horário de verão desde 2019: SP = UTC-3 fixo.
  // 00:00 em SP === 03:00 UTC do mesmo dia.
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0));
}

export function saoPauloDayRange(
  ref: Date = new Date(),
): { startUtc: Date; endUtc: Date } {
  const { y, m, d } = saoPauloYmd(ref);
  const startUtc = utcMidnightOfSaoPauloDay(y, m, d);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc, endUtc };
}

export function formatSaoPauloDayLabel(
  date: Date,
  opts: { isToday?: boolean } = {},
): string {
  const dm = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replace(".", "")
    .replace(/^0/, "");
  if (opts.isToday) return `Hoje · ${dm}`;
  const wd = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "short",
  })
    .format(date)
    .replace(".", "")
    .toLowerCase();
  return `${wd}, ${dm}`;
}
```

- [ ] **Step 1.4: Rodar testes — devem passar**

```bash
npx vitest run src/lib/dates/__tests__/sao-paulo-day.test.ts
```

Expected: PASS (3 + 2 = 5 specs).

> **Nota:** se `formatSaoPauloDayLabel` falhar por diferença de strings (e.g., `"sex"` vs `"Sex"` ou pontuação), ajustar o helper até bater os asserts. NÃO afrouxar os testes.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/dates/sao-paulo-day.ts src/lib/dates/__tests__/sao-paulo-day.test.ts
git commit -m "feat(dates): add saoPauloDayRange and formatSaoPauloDayLabel helpers"
```

---

## Task 2: Query — matches do dia + próximo dia com jogos

**Files:**
- Create: `src/app/(authenticated)/inicio/_lib/queries.ts`

Sem testes nesta task — a função apenas combina `saoPauloDayRange` (já testado) com chamadas Supabase. O projeto não tem testes existentes para queries de palpites; manter o padrão.

- [ ] **Step 2.1: Implementar queries**

`src/app/(authenticated)/inicio/_lib/queries.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MatchWithPrediction,
  PredictionScore,
} from "@/lib/types/prediction";
import type { Tier } from "@/lib/scoring";
import { saoPauloDayRange } from "@/lib/dates/sao-paulo-day";

const MATCH_SELECT = `
  *,
  home_team:home_team_id(id,code,name,flag_url),
  away_team:away_team_id(id,code,name,flag_url),
  prediction:predictions!left(
    id,user_id,match_id,home_score,away_score,advances_team_id,advances_slot,created_at,updated_at
  )
`;

async function fetchMatchesInRange(
  supabase: SupabaseClient,
  userId: string,
  startUtc: Date,
  endUtc: Date,
): Promise<MatchWithPrediction[]> {
  const matchesP = supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("predictions.user_id", userId)
    .gte("kickoff_at", startUtc.toISOString())
    .lt("kickoff_at", endUtc.toISOString())
    .order("kickoff_at", { ascending: true });

  const scoresP = supabase
    .from("prediction_scores")
    .select("prediction_id, points, tier")
    .eq("user_id", userId);

  const [matchesRes, scoresRes] = await Promise.all([matchesP, scoresP]);
  if (matchesRes.error) throw matchesRes.error;
  if (scoresRes.error) throw scoresRes.error;

  const scoreByPredId = new Map<string, PredictionScore>();
  const scoreRows = (scoresRes.data ?? []) as {
    prediction_id: string;
    points: number;
    tier: Tier;
  }[];
  for (const r of scoreRows) {
    scoreByPredId.set(r.prediction_id, { points: r.points, tier: r.tier });
  }

  return (matchesRes.data ?? []).map((row: { prediction: unknown[] | null }) => {
    const predictionArr = row.prediction;
    const prediction =
      Array.isArray(predictionArr) && predictionArr.length > 0
        ? (predictionArr[0] as MatchWithPrediction["prediction"])
        : null;
    const score = prediction ? (scoreByPredId.get(prediction.id) ?? null) : null;
    return { ...(row as object), prediction, score };
  }) as MatchWithPrediction[];
}

export type DayMatchesResult = {
  matches: MatchWithPrediction[];
  /** Data de referência (qualquer instante dentro do dia em SP) usada para o label. */
  referenceDate: Date | null;
  isToday: boolean;
};

export async function getInicioDayMatches(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<DayMatchesResult> {
  const today = saoPauloDayRange(now);
  const todayMatches = await fetchMatchesInRange(
    supabase,
    userId,
    today.startUtc,
    today.endUtc,
  );

  if (todayMatches.length > 0) {
    return { matches: todayMatches, referenceDate: now, isToday: true };
  }

  // Próximo dia com matches: pegar o menor kickoff_at futuro e expandir para o dia em SP.
  const { data: nextRow, error: nextErr } = await supabase
    .from("matches")
    .select("kickoff_at")
    .gte("kickoff_at", today.endUtc.toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (nextErr) throw nextErr;
  if (!nextRow) return { matches: [], referenceDate: null, isToday: false };

  const nextRef = new Date(nextRow.kickoff_at as string);
  const next = saoPauloDayRange(nextRef);
  const nextMatches = await fetchMatchesInRange(
    supabase,
    userId,
    next.startUtc,
    next.endUtc,
  );
  return { matches: nextMatches, referenceDate: nextRef, isToday: false };
}
```

- [ ] **Step 2.2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. Se houver, corrigir antes de seguir.

- [ ] **Step 2.3: Commit**

```bash
git add src/app/\(authenticated\)/inicio/_lib/queries.ts
git commit -m "feat(inicio): add day-based matches query with next-day fallback"
```

---

## Task 3: `LiveMatchesMock` (client component)

**Files:**
- Create: `src/app/(authenticated)/inicio/_components/live-matches-mock.tsx`

- [ ] **Step 3.1: Implementar mock**

```tsx
"use client";

import { Radio } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { flagSrc } from "@/lib/flags";
import { cn } from "@/lib/utils";

export type MockLiveMatch = {
  id: string;
  home: { code: string; name: string };
  away: { code: string; name: string };
  homeScore: number;
  awayScore: number;
  minute: string; // "67'", "Intervalo"
  period: "1T" | "INT" | "2T" | "PRO" | "PEN";
};

export const MOCK_LIVE: MockLiveMatch[] = [
  {
    id: "mock-live-1",
    home: { code: "BRA", name: "Brasil" },
    away: { code: "ARG", name: "Argentina" },
    homeScore: 2,
    awayScore: 1,
    minute: "67'",
    period: "2T",
  },
];

export function LiveMatchesMock({ matches = MOCK_LIVE }: { matches?: MockLiveMatch[] }) {
  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <Radio className="size-6 opacity-60" aria-hidden />
        <p className="text-sm">Nenhum jogo rolando agora.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {matches.map((m) => (
        <LiveCard key={m.id} match={m} />
      ))}
    </div>
  );
}

function LiveCard({ match }: { match: MockLiveMatch }) {
  return (
    <Card size="sm">
      <CardContent className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-4">
        <TeamSlot code={match.home.code} name={match.home.name} align="end" />
        <div className="flex flex-col items-center gap-1">
          <Badge
            role="status"
            aria-label={`Ao vivo, ${match.minute}`}
            className="gap-1.5 bg-red-600 text-white hover:bg-red-600"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden />
            AO VIVO
          </Badge>
          <div className="font-heading text-2xl tabular-nums leading-none">
            {match.homeScore} <span className="opacity-50">×</span> {match.awayScore}
          </div>
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {match.minute}
          </span>
        </div>
        <TeamSlot code={match.away.code} name={match.away.name} align="start" />
      </CardContent>
    </Card>
  );
}

function TeamSlot({
  code,
  name,
  align,
}: {
  code: string;
  name: string;
  align: "start" | "end";
}) {
  const flag = flagSrc(code, 80);
  const flagEl = flag ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flag}
      alt=""
      width={24}
      height={18}
      loading="lazy"
      className="h-[18px] w-6 rounded-sm object-cover shrink-0"
    />
  ) : (
    <span className="h-[18px] w-6 rounded-sm bg-muted shrink-0" aria-hidden />
  );
  return (
    <div className={cn("flex items-center gap-2 min-w-0", align === "end" ? "justify-end" : "justify-start")}>
      {align === "end" ? (
        <>
          <span className="text-sm truncate" title={name}>
            <span className="hidden sm:inline">{name}</span>
            <span className="font-mono text-xs text-muted-foreground sm:ml-1">{code}</span>
          </span>
          {flagEl}
        </>
      ) : (
        <>
          {flagEl}
          <span className="text-sm truncate" title={name}>
            <span className="font-mono text-xs text-muted-foreground sm:mr-1">{code}</span>
            <span className="hidden sm:inline">{name}</span>
          </span>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3.2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3.3: Commit**

```bash
git add src/app/\(authenticated\)/inicio/_components/live-matches-mock.tsx
git commit -m "feat(inicio): add LiveMatchesMock client component"
```

---

## Task 4: `UpcomingMatchesList`

**Files:**
- Create: `src/app/(authenticated)/inicio/_components/upcoming-matches-list.tsx`

Server component. Recebe matches já buscados e renderiza cards. Sem `GroupSaveForm`.

- [ ] **Step 4.1: Implementar**

```tsx
import { CalendarOff } from "lucide-react";
import { MatchPredictionCard } from "@/app/(authenticated)/palpites/_components/match-prediction-card";
import type { MatchWithPrediction } from "@/lib/types/prediction";

export function UpcomingMatchesList({
  matches,
  dayLabel,
}: {
  matches: MatchWithPrediction[];
  dayLabel: string | null;
}) {
  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <CalendarOff className="size-6 opacity-60" aria-hidden />
        <p className="text-sm">Sem jogos agendados ainda.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {dayLabel ? (
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {dayLabel}
        </p>
      ) : null}
      <div className="grid gap-3">
        {matches.map((m) => (
          <MatchPredictionCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4.2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4.3: Commit**

```bash
git add src/app/\(authenticated\)/inicio/_components/upcoming-matches-list.tsx
git commit -m "feat(inicio): add UpcomingMatchesList using MatchPredictionCard"
```

---

## Task 5: `InicioMatchesTabs` (client) com default dinâmico

**Files:**
- Create: `src/app/(authenticated)/inicio/_components/inicio-matches-tabs.tsx`

- [ ] **Step 5.1: Implementar**

```tsx
"use client";

import { useState } from "react";
import { CalendarDays, Radio } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MatchWithPrediction } from "@/lib/types/prediction";
import { UpcomingMatchesList } from "./upcoming-matches-list";
import { LiveMatchesMock, MOCK_LIVE } from "./live-matches-mock";

type Tab = "upcoming" | "live";

export function InicioMatchesTabs({
  matches,
  dayLabel,
}: {
  matches: MatchWithPrediction[];
  dayLabel: string | null;
}) {
  const liveCount = MOCK_LIVE.length;
  const [tab, setTab] = useState<Tab>(liveCount > 0 ? "live" : "upcoming");

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex flex-col gap-4">
      <TabsList className="self-start">
        <TabsTrigger value="upcoming" className="gap-2">
          <CalendarDays className="size-4" aria-hidden />
          Próximos jogos
        </TabsTrigger>
        <TabsTrigger value="live" className="gap-2">
          <Radio className="size-4" aria-hidden />
          Ao vivo
          {liveCount > 0 ? (
            <span
              className="ml-1 inline-flex size-1.5 rounded-full bg-red-600 animate-pulse"
              aria-label={`${liveCount} ao vivo`}
            />
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming" className="m-0">
        <UpcomingMatchesList matches={matches} dayLabel={dayLabel} />
      </TabsContent>
      <TabsContent value="live" className="m-0">
        <LiveMatchesMock />
      </TabsContent>
    </Tabs>
  );
}
```

> **Nota sobre default & SSR:** o default depende apenas do mock estático (`MOCK_LIVE.length`), determinístico tanto no servidor quanto no cliente, então `useState` resolve sem mismatch. Quando virar dinâmico, recalcular no server e passar `defaultTab` por prop.

- [ ] **Step 5.2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5.3: Commit**

```bash
git add src/app/\(authenticated\)/inicio/_components/inicio-matches-tabs.tsx
git commit -m "feat(inicio): add InicioMatchesTabs with dynamic default tab"
```

---

## Task 6: `UpcomingMatchesSection` (server)

**Files:**
- Create: `src/app/(authenticated)/inicio/_components/upcoming-matches-section.tsx`

- [ ] **Step 6.1: Implementar**

```tsx
import { CalendarDays } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatSaoPauloDayLabel } from "@/lib/dates/sao-paulo-day";
import { getInicioDayMatches } from "../_lib/queries";
import { InicioMatchesTabs } from "./inicio-matches-tabs";

export async function UpcomingMatchesSection() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const { matches, referenceDate, isToday } = await getInicioDayMatches(
    supabase,
    userData.user.id,
  );

  const dayLabel = referenceDate
    ? formatSaoPauloDayLabel(referenceDate, { isToday })
    : null;

  const now = Date.now();
  const openCount = matches.filter(
    (m) => new Date(m.kickoff_at).getTime() > now,
  ).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="inline-flex items-center gap-2 font-heading text-xl tracking-wide">
          <CalendarDays className="size-5 text-primary" />
          Seus próximos jogos
        </CardTitle>
        {openCount > 0 ? (
          <Badge variant="secondary">
            {openCount} aberto{openCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        <InicioMatchesTabs matches={matches} dayLabel={dayLabel} />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6.2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6.3: Commit**

```bash
git add src/app/\(authenticated\)/inicio/_components/upcoming-matches-section.tsx
git commit -m "feat(inicio): add UpcomingMatchesSection server component"
```

---

## Task 7: Substituir o card mockado em `page.tsx`

**Files:**
- Modify: `src/app/(authenticated)/inicio/page.tsx`

- [ ] **Step 7.1: Substituir o `<Card>` antigo**

Em `src/app/(authenticated)/inicio/page.tsx`:

1. Remover imports não usados após a troca: `CalendarDays`, `Skeleton`, e `Card`/`CardContent`/`CardHeader`/`CardTitle` se nenhum outro Card ficar — manter o que ainda é usado pelos cards laterais "Sua posição" e "Aposta da rodada" (mantemos esses como estão).
2. Adicionar import: `import { UpcomingMatchesSection } from "./_components/upcoming-matches-section";`.
3. Substituir o bloco que ia de `<Card>` (linha ~28) até `</Card>` (linha ~45) pelo único elemento `<UpcomingMatchesSection />`.

Resultado esperado da seção:

```tsx
<section className="grid gap-5 lg:grid-cols-[2fr_1fr]">
  <UpcomingMatchesSection />

  <div className="flex flex-col gap-5">
    {/* "Sua posição" e "Aposta da rodada" permanecem inalterados */}
    ...
  </div>
</section>
```

> **Cuidado:** NÃO mexer nos cards "Sua posição" / "Aposta da rodada" / `RankingPreview` / header — fora de escopo.

- [ ] **Step 7.2: Type-check + lint**

```bash
npx tsc --noEmit && npx next lint
```

Expected: 0 errors. Remover qualquer import dead-code apontado pelo lint.

- [ ] **Step 7.3: Smoke do build**

```bash
npx next build
```

Expected: build OK. Tolerável: warnings já existentes do projeto. Não tolerável: erros novos.

- [ ] **Step 7.4: Verificar no navegador**

```bash
npm run dev
```

Verificar manualmente em `http://localhost:3000/inicio`:

1. Card "Seus próximos jogos" agora tem 2 abas: "Próximos jogos" e "Ao vivo".
2. Como há mock ao vivo, a aba inicial é "Ao vivo" (badge AO VIVO + placar 2x1).
3. Trocar para "Próximos jogos": exibe label do dia (ex: `Hoje · 12 jun` ou `sex, 13 jun`) e cards de palpite funcionais (input, salvar) — ou empty state se não houver jogos cadastrados.
4. Layout `2fr_1fr` mantido; cards laterais intactos.
5. Salvar um palpite num card da home → toast "Palpite salvo" e estado "Salvo" idêntico ao da rota /palpites.

- [ ] **Step 7.5: Commit**

```bash
git add src/app/\(authenticated\)/inicio/page.tsx
git commit -m "feat(inicio): wire UpcomingMatchesSection into home page"
```

---

## Task 8: Suite final de testes

- [ ] **Step 8.1: Rodar suite completa**

```bash
npm test
```

Expected: todos os testes passam (incluindo os novos de `sao-paulo-day`). Nenhuma regressão.

- [ ] **Step 8.2: Type-check final**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

---

## Checklist final de scope

- [ ] Helper de fuso isolado em `src/lib/dates/` com testes.
- [ ] Query do dia + fallback de próximo dia funcionando.
- [ ] `MatchPredictionCard` reutilizado SEM duplicação (nenhuma cópia de inputs/save).
- [ ] Mock de "Ao vivo" client-only, sem chamadas de rede.
- [ ] Aba default = "live" enquanto mock for não-vazio.
- [ ] Cards "Sua posição", "Aposta da rodada", `RankingPreview`, header — INTACTOS.
- [ ] Grid `2fr_1fr` preservado.
