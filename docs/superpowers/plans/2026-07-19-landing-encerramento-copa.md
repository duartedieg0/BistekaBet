# Landing de Encerramento da Copa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma segunda versão da home pública (`/`), acionada por flag manual de admin, que exibe uma retrospectiva imersiva de encerramento (coroação do campeão, pódio, números coletivos e classificação final) para visitantes deslogados.

**Architecture:** Render condicional dentro de `src/app/page.tsx` (Abordagem A): `Home` lê a flag `copa_encerrada` via **service-role** e, se ligada e sem usuário, renderiza `<LandingEncerramento>` reusando `RankingPodium`/`RankingList`. Toda leitura da home pública (flag + ranking + contagens) passa por `createAdminClient()`, pois o RLS das tabelas é só `authenticated`. A flag reusa o padrão `app_settings` + toggle de admin do convite de evento.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, Supabase (`@supabase/ssr` + service-role client), Tailwind v4 (tokens `oklch` da marca), Vitest, lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-19-landing-encerramento-copa-design.md`

**Convenções do repo (ler antes de codar):**
- `AGENTS.md`: este Next.js tem convenções próprias — confira `node_modules/next/dist/docs/` para padrões de página `async`/`searchParams`/`next/image` se algo divergir.
- Split puro/IO: lógica pura em `*-core.ts` (sem `server-only`, testável); IO em módulo `server-only`. Ver `ranking-core.ts` vs `ranking.ts`.
- Testes: Vitest (`npm test`), só funções puras; sem teste de componente. Descrições em pt-BR.
- Rodar toda a suíte com `npm test`; checagem de tipos/lint com `npx tsc --noEmit` e `npm run lint`.

---

## File Structure

**Criar:**
- `src/lib/scoring/collective-core.ts` — `pickChampions` (puro).
- `src/lib/scoring/__tests__/collective-core.test.ts` — testes de `pickChampions`.
- `src/lib/scoring/collective.ts` — `loadCollectiveStats` (service-role, IO).
- `src/app/(authenticated)/admin/_components/copa-encerrada-toggle-card.tsx` — card do switch.
- `src/app/_components/landing/encerramento/count-up.tsx` — ilha client de count-up.
- `src/app/_components/landing/encerramento/numbers-section.tsx` — seção "A Copa em números".
- `src/app/_components/landing/encerramento/champion-hero.tsx` — Hero de coroação (mantém logos).
- `src/app/_components/landing/encerramento/final-cta-encerramento.tsx` — CTA final → retrospectiva pessoal.
- `src/app/_components/landing/encerramento/landing-encerramento.tsx` — orquestrador (server).

**Modificar:**
- `src/lib/app-settings.ts` — adicionar `getAppSettingAdmin`.
- `src/lib/scoring/ranking.ts` — extrair `loadRankingWith(client)`; adicionar `loadPublicRanking`.
- `src/lib/scoring/retro.ts` — consumir `loadCollectiveStats` (DRY).
- `src/app/(authenticated)/admin/_actions.ts` — `setCopaEncerrada`; `revalidatePath("/")` em `recomputeAllScores` e `commitImport`.
- `src/app/(authenticated)/admin/page.tsx` — ler flag e renderizar o card novo.
- `src/app/page.tsx` — render condicional pela flag.

---

## Task 1: `pickChampions` (função pura + testes)

**Files:**
- Create: `src/lib/scoring/collective-core.ts`
- Test: `src/lib/scoring/__tests__/collective-core.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/scoring/__tests__/collective-core.test.ts
import { describe, it, expect } from "vitest";
import { pickChampions } from "@/lib/scoring/collective-core";
import type { RankingRow } from "@/lib/scoring/ranking-core";

const row = (over: Partial<RankingRow> = {}): RankingRow => ({
  user_id: "u",
  display_name: "U",
  avatar_url: null,
  paid: true,
  total_points: 0,
  exacts_total: 0,
  exacts_knockout: 0,
  winner_or_draw_total: 0,
  final_points: 0,
  semi_third_final_points: 0,
  rank: 1,
  ...over,
});

describe("pickChampions", () => {
  it("lista vazia → []", () => {
    expect(pickChampions([])).toEqual([]);
  });

  it("um único rank 1 → só ele", () => {
    const r = [row({ user_id: "a", rank: 1 }), row({ user_id: "b", rank: 2 })];
    expect(pickChampions(r).map((x) => x.user_id)).toEqual(["a"]);
  });

  it("empate no 1º → todos os rank 1", () => {
    const r = [
      row({ user_id: "a", rank: 1 }),
      row({ user_id: "b", rank: 1 }),
      row({ user_id: "c", rank: 3 }),
    ];
    expect(pickChampions(r).map((x) => x.user_id)).toEqual(["a", "b"]);
  });

  it("nenhum rank 1 (defensivo) → []", () => {
    expect(pickChampions([row({ user_id: "a", rank: 2 })])).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- collective-core`
Expected: FAIL — `Cannot find module '@/lib/scoring/collective-core'`.

- [ ] **Step 3: Implementar o mínimo**

```ts
// src/lib/scoring/collective-core.ts
import type { RankingRow } from "@/lib/scoring/ranking-core";

/**
 * Retorna todos os participantes empatados no 1º lugar (rank === 1).
 * Empates aparecem como co-campeões. `assignRanks` garante rank === 1 para todos
 * os empatados no topo.
 */
export function pickChampions(rows: RankingRow[]): RankingRow[] {
  return rows.filter((r) => r.rank === 1);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- collective-core`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/collective-core.ts src/lib/scoring/__tests__/collective-core.test.ts
git commit -m "feat(landing): pickChampions (co-campeoes no empate do 1o)"
```

---

## Task 2: `getAppSettingAdmin` (leitura da flag via service-role)

Sem teste unitário (IO puro sobre Supabase). Validado por tipo/lint.

**Files:**
- Modify: `src/lib/app-settings.ts`

- [ ] **Step 1: Adicionar a variante service-role**

Adicionar o import e a função ao final de `src/lib/app-settings.ts` (mantendo `getAppSetting`/`setAppSetting` intactos):

```ts
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Igual a getAppSetting, mas via service-role. Necessário para leitura em
 * contexto anônimo (home pública), onde o RLS de `app_settings` (só
 * `authenticated`) devolveria sempre o fallback. Degrada para o fallback se o
 * client admin não puder ser criado (env ausente) ou a query falhar.
 */
export async function getAppSettingAdmin<T>(key: string, fallback: T): Promise<T> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle<{ value: T }>();
    if (error || !data) return fallback;
    return data.value;
  } catch {
    return fallback;
  }
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/app-settings.ts
git commit -m "feat(landing): getAppSettingAdmin (flag via service-role p/ home publica)"
```

---

## Task 3: `loadPublicRanking` (ranking via service-role, sem tocar em `loadRanking`)

**Files:**
- Modify: `src/lib/scoring/ranking.ts`

- [ ] **Step 1: Refatorar para função interna parametrizada pelo client**

Reescrever `src/lib/scoring/ranking.ts` mantendo o comportamento de `loadRanking` e adicionando `loadPublicRanking`:

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

async function loadRankingWith(supabase: SupabaseClient): Promise<RankingRow[]> {
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

export async function loadRanking(): Promise<RankingRow[]> {
  return loadRankingWith((await createClient()) as unknown as SupabaseClient);
}

/**
 * Ranking para a home pública (visitante anônimo). Usa service-role porque o RLS
 * de `profiles`/`prediction_scores` é só `authenticated`. Expõe apenas dados já
 * públicos do ranking (nome, avatar, pontos).
 */
export async function loadPublicRanking(): Promise<RankingRow[]> {
  return loadRankingWith(createAdminClient() as unknown as SupabaseClient);
}
```

> Nota: o `as unknown as SupabaseClient` evita atrito de tipos entre o client do
> `@supabase/ssr` e o do `@supabase/supabase-js` (ambos expõem `.from().select()`).
> Se o `tsc` aceitar sem o cast, remova-o.

- [ ] **Step 2: Confirmar que os testes de ranking seguem verdes e tipos ok**

Run: `npm test -- ranking-core` e `npx tsc --noEmit`
Expected: PASS; sem erros de tipo. (`ranking-core.ts` não mudou; a agregação é a mesma.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring/ranking.ts
git commit -m "feat(landing): loadPublicRanking (service-role) reusando a agregacao"
```

---

## Task 4: `loadCollectiveStats` + DRY no `retro.ts`

Sem teste unitário novo (IO). O `retro-core.test.ts` cobre a montagem pura e não é afetado.

**Files:**
- Create: `src/lib/scoring/collective.ts`
- Modify: `src/lib/scoring/retro.ts`

- [ ] **Step 1: Criar `loadCollectiveStats`**

```ts
// src/lib/scoring/collective.ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type CollectiveCounts = {
  players: number;
  predictions: number;
  exacts: number;
};

/**
 * Contagens coletivas globais (jogadores, palpites, placares cravados). Via
 * service-role: são agregados não sensíveis e o mesmo valor serve tanto à home
 * pública (anônima) quanto ao /retrospectiva (autenticado). O número de "dias"
 * NÃO vem daqui — cada chamador calcula conforme o contexto.
 */
export async function loadCollectiveStats(): Promise<CollectiveCounts> {
  const supabase = createAdminClient();
  const [players, predictions, exacts] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("predictions").select("id", { count: "exact", head: true }),
    supabase
      .from("prediction_scores")
      .select("prediction_id", { count: "exact", head: true })
      .eq("tier", "exact"),
  ]);

  return {
    players: players.count ?? 0,
    predictions: predictions.count ?? 0,
    exacts: exacts.count ?? 0,
  };
}
```

- [ ] **Step 2: Refatorar `retro.ts` para consumir `loadCollectiveStats`**

Em `src/lib/scoring/retro.ts`:

1. Adicionar o import:
```ts
import { loadCollectiveStats } from "@/lib/scoring/collective";
```

2. Substituir o bloco `Promise.all` atual (que hoje inclui `playersCount`, `predsCount`, `groupExactsCount`) por:
```ts
  const [profile, userScores, counts] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", userId)
      .single(),
    supabase
      .from("prediction_scores")
      .select(
        "points, tier, matches!inner(home_team:home_team_id(code,name), away_team:away_team_id(code,name))",
      )
      .eq("user_id", userId),
    loadCollectiveStats(),
  ]);

  if (profile.error) throw profile.error;
  if (userScores.error) throw userScores.error;
```
(Remover as linhas dos três counts e seus `if (...count.error) throw`.)

3. No objeto `collective` passado a `buildRetrospectiva`, usar `counts`:
```ts
    collective: {
      players: counts.players,
      predictions: counts.predictions,
      exacts: counts.exacts,
      matches: COMPETITION.totalMatches,
      days: raioX.timeline.length || 39,
    },
```

- [ ] **Step 3: Checar tipos e rodar a suíte**

Run: `npx tsc --noEmit` e `npm test`
Expected: sem erros de tipo; toda a suíte verde (inclusive `retro-core`, `collective-core`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/scoring/collective.ts src/lib/scoring/retro.ts
git commit -m "feat(landing): loadCollectiveStats + DRY das contagens no retro.ts"
```

---

## Task 5: Flag no /admin (action + card + wiring + revalidate)

Sem teste unitário (server action + UI). Validado por tipo/lint e verificação manual (Task 12).

**Files:**
- Modify: `src/app/(authenticated)/admin/_actions.ts`
- Create: `src/app/(authenticated)/admin/_components/copa-encerrada-toggle-card.tsx`
- Modify: `src/app/(authenticated)/admin/page.tsx`

- [ ] **Step 1: Adicionar `setCopaEncerrada` em `admin/_actions.ts`**

No fim do arquivo (espelha `setEventInviteEnabled`):

```ts
export async function setCopaEncerrada(
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "unauthenticated" };

    const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin", {
      uid: user.id,
    });
    if (rpcError) return { ok: false, error: rpcError.message };
    if (!isAdmin) return { ok: false, error: "forbidden" };

    await setAppSetting<boolean>("copa_encerrada", enabled);

    revalidatePath("/");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
```

- [ ] **Step 2: Revalidar `/` também nos imports/recompute**

No mesmo arquivo, adicionar `revalidatePath("/");` junto aos `revalidatePath` existentes em **`recomputeAllScores`** (após `revalidatePath("/admin")`) e em **`commitImport`** (junto do bloco de revalidações antes do `return { ok: true, ... }`). Assim uma correção tardia de resultado atualiza o ranking público quando a Copa está encerrada.

- [ ] **Step 3: Criar o card do switch**

```tsx
// src/app/(authenticated)/admin/_components/copa-encerrada-toggle-card.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { setCopaEncerrada } from "../_actions";

export function CopaEncerradaToggleCard({
  defaultEnabled,
}: {
  defaultEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [pending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    startTransition(async () => {
      const result = await setCopaEncerrada(next);
      if (!result.ok) {
        setEnabled(previous);
        toast.error("Não foi possível atualizar o encerramento.");
        return;
      }
      toast.success(
        next
          ? "Landing de encerramento ativada."
          : "Landing de encerramento desativada.",
      );
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <h2 className="font-heading text-2xl tracking-wide">
          Encerramento da Copa
        </h2>
        <p className="text-sm text-muted-foreground">
          Quando ligado, a home pública (visitantes deslogados) passa a exibir a
          landing de retrospectiva: campeão, pódio, números da Copa e a
          classificação final.
        </p>
        <label
          htmlFor="copa-encerrada"
          className="flex cursor-pointer items-center justify-between gap-3 text-sm"
        >
          <span>Exibir landing de retrospectiva</span>
          <Switch
            id="copa-encerrada"
            checked={enabled}
            disabled={pending}
            onCheckedChange={(checked) => handleChange(checked)}
          />
        </label>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Renderizar o card em `admin/page.tsx`**

1. Import: `import { CopaEncerradaToggleCard } from "./_components/copa-encerrada-toggle-card";`
2. Ler a flag junto do `eventInviteEnabled`:
```ts
  const copaEncerrada = await getAppSetting<boolean>("copa_encerrada", false);
```
3. Adicionar no grid, após `<EventInviteToggleCard ... />`:
```tsx
        <CopaEncerradaToggleCard defaultEnabled={copaEncerrada} />
```

- [ ] **Step 5: Checar tipos e lint**

Run: `npx tsc --noEmit` e `npm run lint`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(authenticated\)/admin/_actions.ts src/app/\(authenticated\)/admin/_components/copa-encerrada-toggle-card.tsx src/app/\(authenticated\)/admin/page.tsx
git commit -m "feat(admin): flag copa_encerrada (switch) + revalidate / nos imports"
```

---

## Task 6: `CountUp` (ilha client)

**Files:**
- Create: `src/app/_components/landing/encerramento/count-up.tsx`

- [ ] **Step 1: Implementar o count-up com IntersectionObserver + reduced-motion**

```tsx
// src/app/_components/landing/encerramento/count-up.tsx
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Anima a contagem de 0 até `value` quando entra na viewport. Respeita
 * prefers-reduced-motion (mostra o valor final direto). Sem lib externa.
 */
export function CountUp({
  value,
  durationMs = 1200,
}: {
  value: number;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / durationMs, 1);
          const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
          setDisplay(Math.round(eased * value));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, durationMs]);

  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString("pt-BR")}
    </span>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/landing/encerramento/count-up.tsx
git commit -m "feat(landing): CountUp (island, reduced-motion aware)"
```

---

## Task 7: `NumbersSection`

**Files:**
- Create: `src/app/_components/landing/encerramento/numbers-section.tsx`

- [ ] **Step 1: Implementar a seção de números**

```tsx
// src/app/_components/landing/encerramento/numbers-section.tsx
import { COMPETITION } from "@/lib/bolao-config";
import { CountUp } from "./count-up";

type Props = {
  players: number;
  predictions: number;
  exacts: number;
  days: number;
};

export function NumbersSection({ players, predictions, exacts, days }: Props) {
  const stats = [
    { label: "Jogadores", value: players },
    { label: "Palpites", value: predictions },
    { label: "Placares cravados", value: exacts },
    { label: "Dias de bolão", value: days },
    { label: "Jogos", value: COMPETITION.totalMatches },
  ];

  return (
    <section className="relative isolate overflow-hidden bg-[oklch(0.14_0.01_30)] py-20 text-[oklch(0.97_0.01_60)] sm:py-28">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,oklch(0.85_0.18_85/0.12),transparent_70%)]"
      />
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.28em] text-[oklch(0.85_0.18_85)]">
          A Copa em números
        </p>
        <h2 className="mb-12 text-center font-heading text-4xl uppercase tracking-tight sm:text-5xl">
          O que essa galera aprontou
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center backdrop-blur-sm"
            >
              <dd className="font-heading text-4xl tabular-nums text-white sm:text-5xl">
                <CountUp value={s.value} />
              </dd>
              <dt className="text-xs uppercase tracking-widest text-white/50">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/landing/encerramento/numbers-section.tsx
git commit -m "feat(landing): NumbersSection (retrospectiva coletiva com count-up)"
```

---

## Task 8: `ChampionHero` (coroação, mantém os logos)

**Files:**
- Create: `src/app/_components/landing/encerramento/champion-hero.tsx`

- [ ] **Step 1: Implementar o Hero de coroação**

```tsx
// src/app/_components/landing/encerramento/champion-hero.tsx
import Image from "next/image";
import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/app/(authenticated)/_components/avatar-fallback";
import { GoogleSignInButton } from "../../google-sign-in-button";
import { COMPETITION } from "@/lib/bolao-config";
import type { RankingRow } from "@/lib/scoring/ranking-core";

export function ChampionHero({
  champions,
  errorMessage,
}: {
  champions: RankingRow[];
  errorMessage?: string | null;
}) {
  const multiple = champions.length > 1;

  return (
    <section className="relative isolate overflow-hidden bg-[oklch(0.14_0.01_30)] text-[oklch(0.97_0.01_60)]">
      <BackgroundDecor />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pt-20 pb-24 lg:grid-cols-[1.15fr_1fr] lg:gap-10 lg:pt-28 lg:pb-32">
        <div className="flex flex-col items-start gap-7 text-left">
          <Badge
            variant="outline"
            className="border-white/20 bg-white/5 text-xs uppercase tracking-widest text-[oklch(0.85_0.18_85)] backdrop-blur"
          >
            <Crown className="size-3" /> Copa 2026 · Encerrada ·{" "}
            {COMPETITION.startLabel} → {COMPETITION.endLabel}
          </Badge>

          <h1 className="font-heading text-5xl uppercase leading-[0.92] tracking-tight sm:text-6xl md:text-7xl lg:text-[5.75rem]">
            A Copa acabou.{" "}
            <span className="text-[oklch(0.85_0.18_85)]">
              {multiple ? "Temos campeões." : "Temos um campeão."}
            </span>
          </h1>

          <p className="max-w-xl text-lg text-white/70 sm:text-xl">
            39 dias, {COMPETITION.totalMatches} jogos e muita resenha. Veja quem
            levantou a taça do bolão da Patota Bistekas e Equipe Coringas.
          </p>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <GoogleSignInButton
              size="lg"
              variant="accent"
              label="Entrar e ver minha retrospectiva"
            />
            <a
              href="#classificacao"
              className={
                buttonVariants({ variant: "outline", size: "lg" }) +
                " border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              }
            >
              Ver classificação
            </a>
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-[oklch(0.85_0.18_25)]"
            >
              {errorMessage}
            </p>
          )}
        </div>

        <ChampionShowcase champions={champions} />
      </div>
    </section>
  );
}

function BackgroundDecor() {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.85_0.18_85/0.28),transparent_60%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_30%_at_85%_30%,oklch(0.62_0.20_18/0.20),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,transparent,oklch(0.14_0.01_30))] [mask-image:linear-gradient(to_bottom,transparent,black_60%)]"
      />
    </>
  );
}

function ChampionShowcase({ champions }: { champions: RankingRow[] }) {
  return (
    <div className="relative w-full justify-self-center lg:justify-self-end">
      {/* Spotlight dourado (shimmer contido, Q9) */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_60%_at_50%_40%,oklch(0.85_0.18_85/0.30),transparent_70%)]"
      />

      {champions.length > 0 ? (
        <div className="flex flex-wrap items-end justify-center gap-8">
          {champions.map((c) => (
            <div
              key={c.user_id}
              className="flex flex-col items-center gap-3 duration-700 ease-out animate-in fade-in slide-in-from-bottom-4"
            >
              <div className="relative">
                <Crown
                  className="absolute -top-9 left-1/2 size-9 -translate-x-1/2 animate-float text-[oklch(0.85_0.18_85)] drop-shadow"
                  aria-hidden
                />
                <Avatar className="size-32 ring-4 ring-[oklch(0.85_0.18_85)] shadow-[0_0_70px_-10px_oklch(0.85_0.18_85/0.75)] sm:size-40">
                  {c.avatar_url ? <AvatarImage src={c.avatar_url} alt="" /> : null}
                  <AvatarFallback className="bg-white/10 font-heading text-3xl uppercase text-white">
                    {getInitials(c.display_name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <span className="rounded-full bg-[oklch(0.85_0.18_85)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[oklch(0.14_0.01_30)]">
                Campeão
              </span>
              <p className="font-heading text-2xl uppercase tracking-wide text-white">
                {c.display_name}
              </p>
              <p className="flex items-baseline gap-1.5">
                <span className="font-heading text-4xl tabular-nums text-[oklch(0.85_0.18_85)]">
                  {c.total_points}
                </span>
                <span className="text-xs uppercase tracking-widest text-white/50">
                  pts
                </span>
              </p>
              <p className="text-xs tabular-nums text-white/50">
                {c.exacts_total} placares cravados
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Logos mantidos da Hero (mascote + Coringas) */}
      <div className="mt-10 flex items-end justify-center gap-6">
        <Image
          src="/BISTECA.png"
          alt="Mascote Bisteka"
          width={240}
          height={309}
          className="motion-safe:animate-float h-auto w-[clamp(120px,18vw,200px)] drop-shadow-[0_30px_40px_oklch(0.14_0.01_30/0.6)]"
        />
        <Image
          src="/logo_coringas.png"
          alt="Logo Equipe Coringas — parceria"
          width={707}
          height={1000}
          className="h-auto w-[clamp(90px,13vw,150px)] drop-shadow-[0_20px_30px_oklch(0.14_0.01_30/0.6)]"
        />
      </div>
    </div>
  );
}
```

> Requisito atendido: os dois logos da Hero (mascote `BISTECA.png` +
> `logo_coringas.png`) permanecem. Se a proporção do mascote no seu `Hero` atual
> divergir (lá é 560×720), ajuste `width/height` mantendo a razão.

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/landing/encerramento/champion-hero.tsx
git commit -m "feat(landing): ChampionHero (coroacao, mantem logos, co-campeoes)"
```

---

## Task 9: `FinalCtaEncerramento`

**Files:**
- Create: `src/app/_components/landing/encerramento/final-cta-encerramento.tsx`

- [ ] **Step 1: Implementar o CTA final**

```tsx
// src/app/_components/landing/encerramento/final-cta-encerramento.tsx
import Image from "next/image";
import { GoogleSignInButton } from "../../google-sign-in-button";

export function FinalCtaEncerramento() {
  return (
    <section className="relative isolate overflow-hidden bg-[oklch(0.14_0.01_30)] py-24 text-[oklch(0.97_0.01_60)] sm:py-32">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,oklch(0.62_0.20_18/0.35),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.85_0.18_85/0.6)] to-transparent"
      />

      <div className="mx-auto flex max-w-4xl flex-col items-center gap-7 px-6 text-center">
        <Image
          src="/BISTECA.png"
          alt=""
          width={120}
          height={154}
          className="h-28 w-auto drop-shadow-[0_20px_30px_oklch(0.14_0.01_30/0.6)]"
        />
        <p className="text-xs font-semibold uppercase tracking-widest text-[oklch(0.85_0.18_85)]">
          Sua campanha, do início ao fim
        </p>
        <h2 className="font-heading text-5xl uppercase leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">
          Reviva a <span className="text-[oklch(0.85_0.18_85)]">sua Copa.</span>
        </h2>
        <p className="max-w-2xl text-lg text-white/70">
          Entre e veja a sua retrospectiva: sua jornada no ranking, seus placares
          cravados e a sua persona da Copa.
        </p>
        <GoogleSignInButton
          size="lg"
          variant="accent"
          label="Entrar e ver minha retrospectiva"
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/landing/encerramento/final-cta-encerramento.tsx
git commit -m "feat(landing): CTA final -> retrospectiva pessoal"
```

---

## Task 10: `LandingEncerramento` (orquestrador server)

**Files:**
- Create: `src/app/_components/landing/encerramento/landing-encerramento.tsx`

- [ ] **Step 1: Implementar o orquestrador**

```tsx
// src/app/_components/landing/encerramento/landing-encerramento.tsx
import { loadPublicRanking } from "@/lib/scoring/ranking";
import { loadCollectiveStats } from "@/lib/scoring/collective";
import { pickChampions } from "@/lib/scoring/collective-core";
import { COMPETITION } from "@/lib/bolao-config";
import { RankingPodium } from "@/app/(authenticated)/classificacao/_components/ranking-podium";
import { RankingList } from "@/app/(authenticated)/classificacao/_components/ranking-list";
import { ChampionHero } from "./champion-hero";
import { NumbersSection } from "./numbers-section";
import { FinalCtaEncerramento } from "./final-cta-encerramento";

/** Dias corridos da competição (inclusivo). ~39 para 11 jun → 19 jul. */
function competitionDays(): number {
  const start = new Date(`${COMPETITION.startDate}T00:00:00Z`).getTime();
  const end = new Date(`${COMPETITION.endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000) + 1;
}

export async function LandingEncerramento({
  errorMessage,
}: {
  errorMessage?: string | null;
}) {
  const [rows, counts] = await Promise.all([
    loadPublicRanking(),
    loadCollectiveStats(),
  ]);
  const champions = pickChampions(rows);

  return (
    <main className="flex flex-col">
      <ChampionHero champions={champions} errorMessage={errorMessage} />

      {rows.length === 0 ? (
        <section className="mx-auto w-full max-w-3xl px-6 py-24 text-center text-muted-foreground">
          A classificação final aparecerá aqui assim que os resultados forem
          registrados.
        </section>
      ) : (
        <>
          <section className="mx-auto w-full max-w-7xl px-6 py-16">
            <RankingPodium rows={rows.slice(0, 3)} />
          </section>

          <NumbersSection
            players={counts.players}
            predictions={counts.predictions}
            exacts={counts.exacts}
            days={competitionDays()}
          />

          <section
            id="classificacao"
            className="mx-auto w-full max-w-7xl scroll-mt-20 px-6 py-16"
          >
            <header className="mb-8 flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Bolão Copa 2026
              </p>
              <h2 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
                Classificação final
              </h2>
              <p className="text-muted-foreground">
                {rows.length}{" "}
                {rows.length === 1 ? "participante" : "participantes"}.
              </p>
            </header>
            <RankingList rows={rows.slice(3)} />
          </section>
        </>
      )}

      <FinalCtaEncerramento />
    </main>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/landing/encerramento/landing-encerramento.tsx
git commit -m "feat(landing): LandingEncerramento (orquestrador, reusa podio/lista)"
```

---

## Task 11: Ligar a flag na home (`page.tsx`)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Render condicional pela flag**

1. Adicionar imports:
```ts
import { getAppSettingAdmin } from "@/lib/app-settings";
import { LandingEncerramento } from "./_components/landing/encerramento/landing-encerramento";
```
2. Após `const errorMessage = ...`, ler a flag (service-role) e ramificar antes do `return` atual:
```tsx
  const copaEncerrada = await getAppSettingAdmin<boolean>(
    "copa_encerrada",
    false,
  );
  if (copaEncerrada) {
    return (
      <>
        <LandingNav />
        <LandingEncerramento errorMessage={errorMessage} />
        <LandingFooter />
      </>
    );
  }
```
(O `return` da landing pré-torneio atual permanece logo abaixo, inalterado.)

- [ ] **Step 2: Checar tipos e lint**

Run: `npx tsc --noEmit` e `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(landing): render condicional da landing de encerramento em /"
```

---

## Task 12: Verificação final (build + suíte + manual)

**Files:** nenhum (verificação).

- [ ] **Step 1: Suíte completa + tipos + lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tudo verde, sem erros.

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros. (Confere padrões de `next/image`/RSC do Next 16 — ver `AGENTS.md` se algo divergir.)

- [ ] **Step 3: Verificação manual (dev)**

Run: `npm run dev` e conferir:
1. `/admin` mostra o card "Encerramento da Copa"; ligar o switch mostra toast de sucesso.
2. Numa aba anônima (deslogado), `/` exibe a landing de encerramento: Hero de coroação com os **dois logos**, pódio, números (count-up ao rolar), classificação final e CTA.
3. `prefers-reduced-motion` (DevTools → Rendering → Emulate CSS prefers-reduced-motion: reduce): números aparecem estáticos (valor final).
4. Logado, `/` continua redirecionando para `/inicio`.
5. Desligar o switch em `/admin` → `/` (anônimo) volta à landing pré-torneio.
6. Os CTAs de login levam, após autenticar, ao fluxo normal (o gancho é `/retrospectiva`).

- [ ] **Step 4: Commit final (se houver ajuste)**

Sem mudanças de código esperadas aqui; se algum ajuste surgir na verificação, commitar com mensagem descritiva.

---

## Notas de risco (do spec)

- **Env service-role em produção:** `/` passa a depender de `SUPABASE_SERVICE_ROLE_KEY` quando a flag está ligada. Já é usado nos server actions de import, então deve estar presente. `getAppSettingAdmin` degrada para `false` se faltar (mostra a landing pré-torneio em vez de quebrar) — mas `loadPublicRanking` lançaria se a flag estivesse `true` sem a env. Confirmar a env no ambiente de produção antes de ligar a flag.
- **Empate no 1º:** `pickChampions` cobre co-campeões (Task 1); o Hero renderiza lado a lado.
- **Poucos/nenhum participante:** `rows.length === 0` cai no estado neutro; 1–2 participantes seguem o comportamento de `/classificacao` (pódio/lista se adaptam).
