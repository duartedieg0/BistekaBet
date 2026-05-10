# Import de Resultados via API-Football — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin button that imports finalized Copa 2026 match results from API-Football v3, showing a diff/preview before committing, logging each run for audit, and triggering score recompute for affected predictions.

**Architecture:** Server-side fetch (Next.js Server Actions) → Zod validation → mapper → diff against DB rows → modal confirms → transactional update + `import_runs` insert → `recomputeMatchScores` per changed match. Matching via new `api_football_id` columns on `teams` and `matches` (seeded once via script).

**Tech Stack:** Next.js 15, Supabase (Postgres + RLS), Zod, Vitest, Sonner (toasts), `@base-ui/react/dialog` (modal), `pnpm`.

**Spec:** `docs/superpowers/specs/2026-05-10-import-resultados-api-football-design.md` — read it before starting.

---

## File Structure

**Create:**
- `supabase/sql/013_api_football_ids.sql` — migration: `api_football_id` columns + `import_runs` table + RLS
- `src/lib/api-football/types.ts` — TS types (one source of truth)
- `src/lib/api-football/schemas.ts` — Zod schemas (FixtureSchema, TeamSchema, FixturesResponseSchema, TeamsResponseSchema)
- `src/lib/api-football/client.ts` — fetch wrapper (`fetchFixtures`, `fetchTeams`)
- `src/lib/api-football/mapper.ts` — `mapFixtureToPatch(fixture, dbMatch)` → patch + winner derivation + status mapping
- `src/lib/api-football/diff.ts` — `buildDiffEntry(dbMatch, patch)` → `DiffEntry | null`
- `src/lib/api-football/__tests__/mapper.test.ts`
- `src/lib/api-football/__tests__/diff.test.ts`
- `src/app/(authenticated)/admin/_components/import-results-card.tsx`
- `src/app/(authenticated)/admin/_components/import-diff-dialog.tsx`
- `scripts/seed-api-football-ids.ts`

**Modify:**
- `src/app/(authenticated)/admin/_actions.ts` — add `previewImport()` and `commitImport(entries)` server actions
- `src/app/(authenticated)/admin/page.tsx` — render `<ImportResultsCard />` next to `<RecomputeScoresCard />`
- `src/lib/types/match.ts` — add `api_football_id: number | null` em ambas as interfaces `Match` e `Team` (as duas vivem nesse mesmo arquivo)
- `.env.local.example` — document `API_FOOTBALL_KEY`, `API_FOOTBALL_LEAGUE_ID`, `API_FOOTBALL_SEASON`

---

## Task 1 — Migration: `api_football_id` columns + `import_runs` table

**Files:**
- Create: `supabase/sql/013_api_football_ids.sql`

- [ ] **Step 1: Create migration file**

```sql
-- BistekaBet — colunas api_football_id em teams/matches + tabela import_runs (auditoria de imports)

alter table public.teams add column if not exists api_football_id bigint unique;
alter table public.matches add column if not exists api_football_id bigint unique;

create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid references auth.users(id),
  source text not null default 'api-football',
  matches_updated int not null default 0,
  matches_unchanged int not null default 0,
  matches_errored int not null default 0,
  diff jsonb not null default '[]'::jsonb
);

create index if not exists import_runs_created_at_desc_idx
  on public.import_runs (created_at desc);

alter table public.import_runs enable row level security;

drop policy if exists "admins read import_runs" on public.import_runs;
create policy "admins read import_runs" on public.import_runs
  for select using (public.is_admin(auth.uid()));

drop policy if exists "admins insert import_runs" on public.import_runs;
create policy "admins insert import_runs" on public.import_runs
  for insert with check (public.is_admin(auth.uid()));
```

- [ ] **Step 2: Apply migration to local Supabase**

Run: `pnpm supabase db push` (or whatever the project uses — check `package.json` scripts; if absent, paste SQL into Supabase Studio SQL editor).

Expected: migration applies, no errors.

- [ ] **Step 3: Sanity check the schema**

In Supabase Studio SQL editor, run:
```sql
select column_name from information_schema.columns
  where table_schema='public' and table_name='matches' and column_name='api_football_id';
select column_name from information_schema.columns
  where table_schema='public' and table_name='import_runs';
```
Expected: both queries return rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/sql/013_api_football_ids.sql
git commit -m "feat(db): api_football_id em teams/matches + tabela import_runs"
```

---

## Task 2 — Update TypeScript row types

**Files:**
- Modify: `src/lib/types/match.ts` (este arquivo exporta tanto `Match` quanto `Team`)

- [ ] **Step 1: Add `api_football_id` em `Match` e `Team`**

No arquivo `src/lib/types/match.ts`, adicionar em ambas as interfaces:
```ts
api_football_id: number | null;
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/match.ts
git commit -m "types: api_football_id em Team e Match"
```

---

## Task 3 — Zod schemas for API-Football responses

**Files:**
- Create: `src/lib/api-football/schemas.ts`
- Create: `src/lib/api-football/types.ts`

- [ ] **Step 1: Create `schemas.ts`**

```ts
import { z } from "zod";

// status.short é a chave para decidir mapping; pinamos via z.enum para detectar mudança de schema da API.
// Ver §3.1 do spec.
export const ApiFootballStatusShort = z.enum([
  "TBD", "NS", "1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT",
  "FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO", "LIVE",
]);

export const FixtureSchema = z.object({
  fixture: z.object({
    id: z.number().int(),
    date: z.string(),
    status: z.object({
      short: ApiFootballStatusShort,
      long: z.string(),
    }),
  }),
  teams: z.object({
    home: z.object({ id: z.number().int(), name: z.string() }),
    away: z.object({ id: z.number().int(), name: z.string() }),
  }),
  goals: z.object({
    home: z.number().int().nullable(),
    away: z.number().int().nullable(),
  }),
  score: z.object({
    halftime:  z.object({ home: z.number().int().nullable(), away: z.number().int().nullable() }),
    fulltime:  z.object({ home: z.number().int().nullable(), away: z.number().int().nullable() }),
    extratime: z.object({ home: z.number().int().nullable(), away: z.number().int().nullable() }),
    penalty:   z.object({ home: z.number().int().nullable(), away: z.number().int().nullable() }),
  }),
});

export const FixturesResponseSchema = z.object({
  response: z.array(FixtureSchema),
});

export const TeamSchema = z.object({
  team: z.object({
    id: z.number().int(),
    name: z.string(),
    code: z.string().nullable(),
  }),
});

export const TeamsResponseSchema = z.object({
  response: z.array(TeamSchema),
});
```

- [ ] **Step 2: Create `types.ts` (re-export inferred types)**

```ts
import type { z } from "zod";
import type {
  FixtureSchema, TeamSchema, ApiFootballStatusShort,
} from "./schemas";

export type ApiFootballFixture = z.infer<typeof FixtureSchema>;
export type ApiFootballTeam = z.infer<typeof TeamSchema>;
export type ApiFootballStatus = z.infer<typeof ApiFootballStatusShort>;

// Patch aplicável em matches (campos opcionais — só os que mudam vão preenchidos no diff)
export type MatchPatch = {
  api_football_id?: number;          // sempre presente quando vem do mapper
  home_score: number | null;
  away_score: number | null;
  home_score_et: number | null;
  away_score_et: number | null;
  home_pens: number | null;
  away_pens: number | null;
  winner_team_id: string | null;
  status: "postponed" | "cancelled" | null;
};

export type DiffEntry = {
  matchId: string;
  apiFootballId: number;
  label: string;
  changes: Array<{
    field:
      | "home_score" | "away_score"
      | "home_score_et" | "away_score_et"
      | "home_pens" | "away_pens"
      | "winner_team_id" | "status";
    from: unknown;
    to: unknown;
  }>;
  willRecompute: boolean;
};
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`. Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-football/schemas.ts src/lib/api-football/types.ts
git commit -m "feat(api-football): zod schemas + tipos para fixtures/teams"
```

---

## Task 4 — `mapper.ts` — pure function (TDD)

A pure function: `(fixture, homeMatchTeamId, awayMatchTeamId) → MatchPatch`. No I/O. Status mapping critical (spec §3.1).

**Files:**
- Create: `src/lib/api-football/__tests__/mapper.test.ts`
- Create: `src/lib/api-football/mapper.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/api-football/__tests__/mapper.test.ts
import { describe, it, expect } from "vitest";
import { mapFixtureToPatch } from "@/lib/api-football/mapper";
import type { ApiFootballFixture } from "@/lib/api-football/types";

const HOME = "00000000-0000-0000-0000-000000000001";
const AWAY = "00000000-0000-0000-0000-000000000002";

const baseFixture = (overrides: Partial<ApiFootballFixture> = {}): ApiFootballFixture => ({
  fixture: { id: 999, date: "2026-06-12T20:00:00Z",
             status: { short: "FT", long: "Match Finished" } },
  teams: { home: { id: 1, name: "Brasil" }, away: { id: 2, name: "Argentina" } },
  goals: { home: 2, away: 1 },
  score: {
    halftime:  { home: 1, away: 0 },
    fulltime:  { home: 2, away: 1 },
    extratime: { home: null, away: null },
    penalty:   { home: null, away: null },
  },
  ...overrides,
});

describe("mapFixtureToPatch", () => {
  it("FT: regulation win, winner=home, status=null", () => {
    const p = mapFixtureToPatch(baseFixture(), HOME, AWAY);
    expect(p).toMatchObject({
      api_football_id: 999,
      home_score: 2, away_score: 1,
      home_score_et: null, away_score_et: null,
      home_pens: null, away_pens: null,
      winner_team_id: HOME,
      status: null,
    });
  });

  it("FT: draw in group stage, winner_team_id=null", () => {
    const p = mapFixtureToPatch(baseFixture({
      goals: { home: 1, away: 1 },
      score: { halftime: { home:0, away:0 }, fulltime:{ home:1, away:1 },
               extratime:{ home:null, away:null }, penalty:{ home:null, away:null } },
    }), HOME, AWAY);
    expect(p.winner_team_id).toBeNull();
  });

  it("AET: extra time decides", () => {
    const p = mapFixtureToPatch(baseFixture({
      fixture: { id: 999, date: "2026-06-12T20:00:00Z",
                 status: { short: "AET", long: "Match Finished after Extra Time" } },
      goals: { home: 3, away: 2 },
      score: { halftime:{ home:1, away:1 }, fulltime:{ home:2, away:2 },
               extratime:{ home:1, away:0 }, penalty:{ home:null, away:null } },
    }), HOME, AWAY);
    expect(p.home_score_et).toBe(1);
    expect(p.away_score_et).toBe(0);
    expect(p.winner_team_id).toBe(HOME); // 3 > 2
    expect(p.status).toBeNull();
  });

  it("PEN: away wins shootout", () => {
    const p = mapFixtureToPatch(baseFixture({
      fixture: { id: 999, date: "2026-06-12T20:00:00Z",
                 status: { short: "PEN", long: "Match Finished after Penalties" } },
      goals: { home: 2, away: 2 },
      score: { halftime:{ home:1, away:1 }, fulltime:{ home:2, away:2 },
               extratime:{ home:0, away:0 }, penalty:{ home:3, away:5 } },
    }), HOME, AWAY);
    expect(p.home_pens).toBe(3);
    expect(p.away_pens).toBe(5);
    expect(p.winner_team_id).toBe(AWAY);
    expect(p.status).toBeNull();
  });

  it("PST → status='postponed', placares null", () => {
    const p = mapFixtureToPatch(baseFixture({
      fixture: { id: 999, date: "2026-06-12T20:00:00Z",
                 status: { short: "PST", long: "Match Postponed" } },
      goals: { home: null, away: null },
      score: { halftime:{ home:null, away:null }, fulltime:{ home:null, away:null },
               extratime:{ home:null, away:null }, penalty:{ home:null, away:null } },
    }), HOME, AWAY);
    expect(p.status).toBe("postponed");
    expect(p.home_score).toBeNull();
    expect(p.winner_team_id).toBeNull();
  });

  it("CANC → status='cancelled'", () => {
    const p = mapFixtureToPatch(baseFixture({
      fixture: { id: 999, date: "2026-06-12T20:00:00Z",
                 status: { short: "CANC", long: "Match Cancelled" } },
      goals: { home: null, away: null },
      score: { halftime:{ home:null, away:null }, fulltime:{ home:null, away:null },
               extratime:{ home:null, away:null }, penalty:{ home:null, away:null } },
    }), HOME, AWAY);
    expect(p.status).toBe("cancelled");
  });
});
```

- [ ] **Step 2: Run tests, see them fail**

Run: `pnpm test src/lib/api-football/__tests__/mapper.test.ts`
Expected: FAIL — `mapFixtureToPatch is not defined`.

- [ ] **Step 3: Implement `mapper.ts`**

```ts
// src/lib/api-football/mapper.ts
import type { ApiFootballFixture, MatchPatch } from "./types";

const FINISHED = new Set(["FT", "AET", "PEN"] as const);

export function mapFixtureToPatch(
  fixture: ApiFootballFixture,
  homeMatchTeamId: string,
  awayMatchTeamId: string,
): MatchPatch {
  const { score, goals, fixture: fx } = fixture;
  const short = fx.status.short;

  // Status mapping (spec §3.1)
  let status: MatchPatch["status"] = null;
  if (short === "PST") status = "postponed";
  else if (short === "CANC") status = "cancelled";

  const isFinished = FINISHED.has(short as "FT" | "AET" | "PEN");

  // Pull scores only if finished; PST/CANC keep null
  const home_score      = isFinished ? goals.home : null;
  const away_score      = isFinished ? goals.away : null;
  const home_score_et   = isFinished && short !== "FT" ? score.extratime.home : null;
  const away_score_et   = isFinished && short !== "FT" ? score.extratime.away : null;
  const home_pens       = short === "PEN" ? score.penalty.home : null;
  const away_pens       = short === "PEN" ? score.penalty.away : null;

  // Winner derivation
  let winner_team_id: string | null = null;
  if (isFinished && home_score !== null && away_score !== null) {
    if (short === "PEN" && home_pens !== null && away_pens !== null) {
      winner_team_id = home_pens > away_pens ? homeMatchTeamId : awayMatchTeamId;
    } else {
      const h = home_score + (home_score_et ?? 0);
      const a = away_score + (away_score_et ?? 0);
      if (h > a) winner_team_id = homeMatchTeamId;
      else if (a > h) winner_team_id = awayMatchTeamId;
      else winner_team_id = null; // empate em fase de grupos
    }
  }

  return {
    api_football_id: fx.id,
    home_score, away_score,
    home_score_et, away_score_et,
    home_pens, away_pens,
    winner_team_id,
    status,
  };
}
```

- [ ] **Step 4: Run tests, see them pass**

Run: `pnpm test src/lib/api-football/__tests__/mapper.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-football/mapper.ts src/lib/api-football/__tests__/mapper.test.ts
git commit -m "feat(api-football): mapper fixture->MatchPatch + testes"
```

---

## Task 5 — `diff.ts` — produce `DiffEntry` (TDD)

Pure function: compares DB row vs `MatchPatch`, returns `DiffEntry` or `null` (no changes).

**Files:**
- Create: `src/lib/api-football/__tests__/diff.test.ts`
- Create: `src/lib/api-football/diff.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/api-football/__tests__/diff.test.ts
import { describe, it, expect } from "vitest";
import { buildDiffEntry } from "@/lib/api-football/diff";
import type { MatchPatch } from "@/lib/api-football/types";

const baseMatch = {
  id: "m1",
  api_football_id: 999,
  home_team_id: "h1", away_team_id: "a1",
  home_team_name: "Brasil", away_team_name: "Argentina",
  home_score: null as number | null,
  away_score: null as number | null,
  home_score_et: null as number | null,
  away_score_et: null as number | null,
  home_pens: null as number | null,
  away_pens: null as number | null,
  winner_team_id: null as string | null,
  status: null as "postponed" | "cancelled" | null,
};

const basePatch = (over: Partial<MatchPatch> = {}): MatchPatch => ({
  api_football_id: 999,
  home_score: 2, away_score: 1,
  home_score_et: null, away_score_et: null,
  home_pens: null, away_pens: null,
  winner_team_id: "h1",
  status: null,
  ...over,
});

describe("buildDiffEntry", () => {
  it("retorna null quando tudo igual", () => {
    const m = { ...baseMatch, home_score: 2, away_score: 1, winner_team_id: "h1" };
    const r = buildDiffEntry(m, basePatch());
    expect(r).toBeNull();
  });

  it("placar mudou → entry com willRecompute=true", () => {
    const r = buildDiffEntry(baseMatch, basePatch());
    expect(r).not.toBeNull();
    expect(r!.willRecompute).toBe(true);
    expect(r!.changes).toEqual(expect.arrayContaining([
      { field: "home_score", from: null, to: 2 },
      { field: "away_score", from: null, to: 1 },
      { field: "winner_team_id", from: null, to: "h1" },
    ]));
    expect(r!.label).toBe("Brasil x Argentina");
  });

  it("só status mudou (postponed→null) → willRecompute=false", () => {
    const m = { ...baseMatch, status: "postponed" as const };
    const patch = basePatch({ home_score: null, away_score: null, winner_team_id: null, status: null });
    const r = buildDiffEntry(m, patch);
    expect(r).not.toBeNull();
    expect(r!.willRecompute).toBe(false);
    expect(r!.changes).toEqual([{ field: "status", from: "postponed", to: null }]);
  });

  it("status mudou para postponed", () => {
    const r = buildDiffEntry(baseMatch, basePatch({
      home_score: null, away_score: null, winner_team_id: null, status: "postponed",
    }));
    expect(r!.changes).toEqual([{ field: "status", from: null, to: "postponed" }]);
    expect(r!.willRecompute).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, see them fail**

Run: `pnpm test src/lib/api-football/__tests__/diff.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `diff.ts`**

```ts
// src/lib/api-football/diff.ts
import type { DiffEntry, MatchPatch } from "./types";

export type DbMatchSlim = {
  id: string;
  api_football_id: number | null;
  home_team_name: string;
  away_team_name: string;
  home_score: number | null;
  away_score: number | null;
  home_score_et: number | null;
  away_score_et: number | null;
  home_pens: number | null;
  away_pens: number | null;
  winner_team_id: string | null;
  status: "postponed" | "cancelled" | null;
};

type Field = DiffEntry["changes"][number]["field"];

const FIELDS: Field[] = [
  "home_score", "away_score",
  "home_score_et", "away_score_et",
  "home_pens", "away_pens",
  "winner_team_id", "status",
];

const SCORE_FIELDS: ReadonlySet<Field> = new Set<Field>([
  "home_score", "away_score", "home_score_et", "away_score_et",
  "home_pens", "away_pens", "winner_team_id",
]);

export function buildDiffEntry(db: DbMatchSlim, patch: MatchPatch): DiffEntry | null {
  const changes: DiffEntry["changes"] = [];
  let willRecompute = false;

  for (const field of FIELDS) {
    const from = (db as Record<string, unknown>)[field];
    const to = (patch as Record<string, unknown>)[field];
    if (from !== to) {
      changes.push({ field, from, to });
      if (SCORE_FIELDS.has(field)) willRecompute = true;
    }
  }

  if (changes.length === 0) return null;
  return {
    matchId: db.id,
    apiFootballId: patch.api_football_id!,
    label: `${db.home_team_name} x ${db.away_team_name}`,
    changes,
    willRecompute,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test src/lib/api-football/__tests__/diff.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-football/diff.ts src/lib/api-football/__tests__/diff.test.ts
git commit -m "feat(api-football): diff DbMatch x MatchPatch + testes"
```

---

## Task 6 — `client.ts` — fetch wrapper

**Files:**
- Create: `src/lib/api-football/client.ts`

- [ ] **Step 1: Implement client**

```ts
// src/lib/api-football/client.ts
import "server-only";
import { FixturesResponseSchema, TeamsResponseSchema } from "./schemas";
import type { ApiFootballFixture, ApiFootballTeam } from "./types";

const BASE = "https://v3.football.api-sports.io";

function getConfig() {
  const key = process.env.API_FOOTBALL_KEY;
  const league = process.env.API_FOOTBALL_LEAGUE_ID;
  const season = process.env.API_FOOTBALL_SEASON;
  if (!key || !league || !season) {
    throw new Error("API-Football env vars missing (API_FOOTBALL_KEY, API_FOOTBALL_LEAGUE_ID, API_FOOTBALL_SEASON)");
  }
  return { key, league, season };
}

async function call<T>(path: string, schema: { parse: (x: unknown) => T }): Promise<T> {
  const { key } = getConfig();
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return schema.parse(json);
}

export async function fetchFixtures(): Promise<ApiFootballFixture[]> {
  const { league, season } = getConfig();
  const r = await call(
    `/fixtures?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`,
    FixturesResponseSchema,
  );
  return r.response;
}

export async function fetchTeams(): Promise<ApiFootballTeam[]> {
  const { league, season } = getConfig();
  const r = await call(
    `/teams?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`,
    TeamsResponseSchema,
  );
  return r.response;
}
```

- [ ] **Step 2: Add env vars to example file**

Append to `.env.local.example` (create if missing):
```
API_FOOTBALL_KEY=
API_FOOTBALL_LEAGUE_ID=
API_FOOTBALL_SEASON=2026
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`. Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-football/client.ts .env.local.example
git commit -m "feat(api-football): fetch wrapper com Zod e env config"
```

---

## Task 7 — Server actions: `previewImport` + `commitImport`

**Files:**
- Modify: `src/app/(authenticated)/admin/_actions.ts`

Padrão estabelecido em `_actions.ts` (verificado): **anon client (`createClient`)** para o check de auth/admin via `is_admin` RPC; **admin client (`createAdminClient`)** para writes que precisam bypassar RLS. Use exatamente isso.

**Atenção (não-transacional):** O cliente JS do Supabase não abre transação. O commit faz `update` linha-a-linha + insert em `import_runs`. Em caso de falha parcial: alguns matches atualizam, outros não, e a row de `import_runs` é inserida com a contagem real (`matches_errored` reflete falhas). Aceitável porque o run é re-executável e o `import_runs.diff` registra a tentativa para auditoria.

- [ ] **Step 1: Read the existing actions file**

```bash
cat "src/app/(authenticated)/admin/_actions.ts"
```

Note: the auth boilerplate, the Supabase client used for writes, the return shape, the use of `revalidatePath`. Mirror it.

- [ ] **Step 2: Append `previewImport` action**

```ts
// add to src/app/(authenticated)/admin/_actions.ts

import { fetchFixtures } from "@/lib/api-football/client";
import { mapFixtureToPatch } from "@/lib/api-football/mapper";
import { buildDiffEntry, type DbMatchSlim } from "@/lib/api-football/diff";
import type { DiffEntry } from "@/lib/api-football/types";

export type PreviewImportResult =
  | { ok: true; entries: DiffEntry[]; skipped: number }
  | { ok: false; error: string };

const FINISHED_OR_OFFFIELD = new Set(["FT","AET","PEN","PST","CANC"]);

export async function previewImport(): Promise<PreviewImportResult> {
  try {
    // Auth + admin (mirror the existing pattern in this file)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "unauthenticated" };
    const { data: isAdmin } = await supabase.rpc("is_admin", { uid: user.id });
    if (!isAdmin) return { ok: false, error: "forbidden" };

    // Load mapped matches (with team names for label)
    const admin = createAdminClient();
    const { data: matches, error: mErr } = await admin
      .from("matches")
      .select(`
        id, api_football_id,
        home_team_id, away_team_id,
        home_score, away_score,
        home_score_et, away_score_et,
        home_pens, away_pens,
        winner_team_id, status,
        home_team:teams!matches_home_team_id_fkey(name, api_football_id),
        away_team:teams!matches_away_team_id_fkey(name, api_football_id)
      `)
      .not("api_football_id", "is", null);
    if (mErr) throw mErr;

    // Supabase types relations as arrays por padrao; normalizamos para single-object via cast.
    type MatchRow = NonNullable<typeof matches>[number] & {
      home_team: { name: string; api_football_id: number | null } | null;
      away_team: { name: string; api_football_id: number | null } | null;
    };
    const rows = (matches ?? []) as unknown as MatchRow[];
    const byApiId = new Map<number, MatchRow>();
    for (const m of rows) byApiId.set(m.api_football_id as number, m);

    const fixtures = await fetchFixtures();
    const entries: DiffEntry[] = [];
    let skipped = 0;

    for (const fx of fixtures) {
      if (!FINISHED_OR_OFFFIELD.has(fx.fixture.status.short)) { skipped++; continue; }
      const m = byApiId.get(fx.fixture.id);
      if (!m || !m.home_team_id || !m.away_team_id) { skipped++; continue; }

      const patch = mapFixtureToPatch(fx, m.home_team_id, m.away_team_id);
      const db: DbMatchSlim = {
        id: m.id,
        api_football_id: m.api_football_id,
        home_team_name: m.home_team?.name ?? "?",
        away_team_name: m.away_team?.name ?? "?",
        home_score: m.home_score, away_score: m.away_score,
        home_score_et: m.home_score_et, away_score_et: m.away_score_et,
        home_pens: m.home_pens, away_pens: m.away_pens,
        winner_team_id: m.winner_team_id,
        status: m.status as DbMatchSlim["status"],
      };
      const entry = buildDiffEntry(db, patch);
      if (entry) entries.push(entry);
    }

    return { ok: true, entries, skipped };
  } catch (err) {
    console.error("previewImport failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
```

- [ ] **Step 3: Append `commitImport` action**

```ts
import { recomputeMatchScores } from "@/lib/scoring/recompute";
import { revalidatePath } from "next/cache";

export type CommitImportResult =
  | { ok: true; updated: number; unchanged: number; errored: number }
  | { ok: false; error: string };

const RATE_LIMIT_MS = 30_000;

export async function commitImport(entries: DiffEntry[]): Promise<CommitImportResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "unauthenticated" };
    const { data: isAdmin } = await supabase.rpc("is_admin", { uid: user.id });
    if (!isAdmin) return { ok: false, error: "forbidden" };

    const admin = createAdminClient();

    // Rate-limit (commits only)
    const { data: lastRun } = await admin
      .from("import_runs")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRun) {
      const age = Date.now() - new Date(lastRun.created_at).getTime();
      if (age < RATE_LIMIT_MS) {
        return { ok: false, error: `aguarde ${Math.ceil((RATE_LIMIT_MS - age) / 1000)}s antes do proximo import` };
      }
    }

    let updated = 0, errored = 0;
    const recomputeIds: string[] = [];

    for (const entry of entries) {
      const patch: Record<string, unknown> = {};
      for (const c of entry.changes) patch[c.field] = c.to;
      const { error: uErr } = await admin
        .from("matches")
        .update(patch)
        .eq("id", entry.matchId);
      if (uErr) { errored++; continue; }
      updated++;
      if (entry.willRecompute) recomputeIds.push(entry.matchId);
    }

    const { error: logErr } = await admin.from("import_runs").insert({
      admin_id: user.id,
      source: "api-football",
      matches_updated: updated,
      matches_unchanged: 0,
      matches_errored: errored,
      diff: entries,
    });
    if (logErr) console.error("import_runs insert failed", logErr);

    // Recompute scores per affected match (idempotent)
    for (const id of recomputeIds) {
      try { await recomputeMatchScores(id); }
      catch (e) { console.error("recompute failed for", id, e); }
    }

    revalidatePath("/admin");
    revalidatePath("/admin/partidas");
    revalidatePath("/leaderboard");

    return { ok: true, updated, unchanged: 0, errored };
  } catch (err) {
    console.error("commitImport failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
```

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors. (If the Supabase select with relationship aliasing complains about types, narrow with explicit casts as shown.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authenticated)/admin/_actions.ts"
git commit -m "feat(admin): server actions previewImport + commitImport"
```

---

## Task 8 — UI: `import-diff-dialog.tsx`

**Files:**
- Create: `src/app/(authenticated)/admin/_components/import-diff-dialog.tsx`

- [ ] **Step 1: Implement dialog**

```tsx
"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DiffEntry } from "@/lib/api-football/types";

type Props = {
  open: boolean;
  entries: DiffEntry[];
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function fmt(v: unknown): string {
  if (v === null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return JSON.stringify(v);
}

export function ImportDiffDialog({ open, entries, pending, onClose, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Confirmar import</DialogTitle>
          <DialogDescription>
            {entries.length === 0
              ? "Nada a importar."
              : `${entries.length} partida(s) serão atualizadas.`}
          </DialogDescription>
        </DialogHeader>

        {entries.length > 0 && (
          <div className="space-y-3 text-sm">
            {entries.map((e) => (
              <div key={e.matchId} className="rounded border p-2">
                <div className="font-medium">{e.label}</div>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {e.changes.map((c, i) => (
                    <li key={i}>
                      <code>{c.field}</code>: {fmt(c.from)} → <strong>{fmt(c.to)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
          {entries.length > 0 && (
            <Button onClick={onConfirm} disabled={pending}>
              {pending ? "Aplicando..." : "Confirmar"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`. Expected: no errors. If `Dialog` import path differs, adjust to match repo convention (verified earlier: `@/components/ui/dialog`).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authenticated)/admin/_components/import-diff-dialog.tsx"
git commit -m "feat(admin): import-diff-dialog (modal de confirmacao)"
```

---

## Task 9 — UI: `import-results-card.tsx`

**Files:**
- Create: `src/app/(authenticated)/admin/_components/import-results-card.tsx`

- [ ] **Step 1: Implement card**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { previewImport, commitImport } from "@/app/(authenticated)/admin/_actions";
import type { DiffEntry } from "@/lib/api-football/types";
import { ImportDiffDialog } from "./import-diff-dialog";

export function ImportResultsCard() {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<DiffEntry[]>([]);

  const onClickPreview = () =>
    startTransition(async () => {
      const r = await previewImport();
      if (!r.ok) { toast.error(`Falha no preview: ${r.error}`); return; }
      setEntries(r.entries);
      setOpen(true);
      if (r.entries.length === 0) toast.info("Nada a importar.");
    });

  const onConfirm = () =>
    startTransition(async () => {
      const r = await commitImport(entries);
      if (!r.ok) { toast.error(`Falha no commit: ${r.error}`); return; }
      toast.success(`${r.updated} atualizadas, ${r.errored} com erro.`);
      setOpen(false);
      setEntries([]);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar resultados (API-Football)</CardTitle>
        <CardDescription>
          Busca placares finalizados, mostra diff e aplica após confirmação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button disabled={pending} onClick={onClickPreview}>
          {pending ? "Carregando..." : "Importar resultados agora"}
        </Button>
      </CardContent>
      <ImportDiffDialog
        open={open}
        entries={entries}
        pending={pending}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
      />
    </Card>
  );
}
```

- [ ] **Step 2: Wire to dashboard**

In `src/app/(authenticated)/admin/page.tsx`, import and render `<ImportResultsCard />` next to the existing `<RecomputeScoresCard />`. Mirror the existing layout.

- [ ] **Step 3: Type-check + lint**

```bash
pnpm tsc --noEmit
pnpm lint
```
Expected: clean.

- [ ] **Step 4: Smoke test in browser**

```bash
pnpm dev
```
- Login as admin, go to `/admin`.
- Click "Importar resultados agora" — without env vars set, expect toast `"Falha no preview: API-Football env vars missing..."`. That confirms the path is wired.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authenticated)/admin/_components/import-results-card.tsx" "src/app/(authenticated)/admin/page.tsx"
git commit -m "feat(admin): card de import + integracao no dashboard"
```

---

## Task 10 — Seed script: `scripts/seed-api-football-ids.ts`

**Files:**
- Create: `scripts/seed-api-football-ids.ts`

- [ ] **Step 1: Implement script**

```ts
// scripts/seed-api-football-ids.ts
// Roda 1x: pnpm tsx scripts/seed-api-football-ids.ts
// Idempotente. Casa teams por nome normalizado e matches por (home_team_id, away_team_id, date).

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { fetchTeams, fetchFixtures } from "../src/lib/api-football/client";

function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error("Supabase env vars missing");
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1) Teams
  const apiTeams = await fetchTeams();
  const { data: dbTeams, error: tErr } = await supabase.from("teams").select("id, name, api_football_id");
  if (tErr) throw tErr;

  const dbByName = new Map(dbTeams!.map((t) => [normalize(t.name), t]));
  let teamsUpdated = 0, teamsAmbiguous = 0;

  for (const at of apiTeams) {
    const t = dbByName.get(normalize(at.team.name));
    if (!t) { console.warn(`[teams] sem match: ${at.team.name} (api_id=${at.team.id})`); teamsAmbiguous++; continue; }
    if (t.api_football_id === at.team.id) continue;
    const { error } = await supabase.from("teams").update({ api_football_id: at.team.id }).eq("id", t.id);
    if (error) { console.error(`[teams] update falhou ${t.name}:`, error.message); continue; }
    teamsUpdated++;
  }
  console.log(`teams: ${teamsUpdated} updated, ${teamsAmbiguous} sem match`);

  // 2) Matches
  const fixtures = await fetchFixtures();
  const { data: dbMatches, error: mErr } = await supabase
    .from("matches")
    .select("id, home_team_id, away_team_id, kickoff_at, api_football_id, home_team:teams!matches_home_team_id_fkey(api_football_id), away_team:teams!matches_away_team_id_fkey(api_football_id)");
  if (mErr) throw mErr;

  let matchesUpdated = 0, matchesUnmatched = 0;

  for (const fx of fixtures) {
    const found = dbMatches!.find((m) => {
      const homeApi = (m.home_team as { api_football_id: number | null } | null)?.api_football_id;
      const awayApi = (m.away_team as { api_football_id: number | null } | null)?.api_football_id;
      if (homeApi !== fx.teams.home.id) return false;
      if (awayApi !== fx.teams.away.id) return false;
      // mesmo dia (UTC) — tolerância pra fusos:
      const dDb = new Date(m.kickoff_at).toISOString().slice(0, 10);
      const dApi = new Date(fx.fixture.date).toISOString().slice(0, 10);
      return dDb === dApi;
    });
    if (!found) { matchesUnmatched++; continue; }
    if (found.api_football_id === fx.fixture.id) continue;
    const { error } = await supabase.from("matches").update({ api_football_id: fx.fixture.id }).eq("id", found.id);
    if (error) { console.error(`[matches] update falhou ${found.id}:`, error.message); continue; }
    matchesUpdated++;
  }
  console.log(`matches: ${matchesUpdated} updated, ${matchesUnmatched} sem match`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Dry-run mentally**

Confirm: env vars present (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `API_FOOTBALL_KEY`, `API_FOOTBALL_LEAGUE_ID`, `API_FOOTBALL_SEASON`).

- [ ] **Step 3: Run the seed (manual, with real env)**

```bash
pnpm tsx scripts/seed-api-football-ids.ts
```
Expected: `teams: 48 updated, 0 sem match` (or some unmatched flagged for manual review). For matches, expect ~48 group-stage games matched on first run; mata-mata fica null.

If teams fail to match by name (likely ≥1 mismatch like "USA" vs "Estados Unidos"), DO NOT hand-edit code — instead manually update the row's `api_football_id` in Supabase Studio and re-run.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-api-football-ids.ts
git commit -m "feat(scripts): seed api_football_id em teams e matches"
```

---

## Task 11 — End-to-end manual smoke test

- [ ] **Step 1: Set env, restart dev**

Set `API_FOOTBALL_KEY`, `API_FOOTBALL_LEAGUE_ID`, `API_FOOTBALL_SEASON` in `.env.local`. Restart `pnpm dev`.

- [ ] **Step 2: Click button → see modal**

Login as admin, `/admin`, click "Importar resultados agora". Modal opens.
- If fixtures already played existed pre-seed: diff lists changes. Confirm — toast shows `X atualizadas`.
- If no diff: `"Nada a importar."`

- [ ] **Step 3: Verify DB**

In Supabase Studio:
```sql
select created_at, matches_updated, matches_errored, jsonb_array_length(diff) as diff_size
  from import_runs order by created_at desc limit 5;
```
Expect 1 fresh row.

- [ ] **Step 4: Verify recompute**

Pick a match that changed. Confirm `prediction_scores` rows reflect new outcome. (Spot-check leaderboard.)

- [ ] **Step 5: Test rate-limit**

Click button again immediately after confirm. Expect toast `"aguarde Xs antes do proximo import"` from `commitImport`. (Preview can still run; rate-limit is commit-only by design.)

- [ ] **Step 6: Final commit (if any tweaks)**

```bash
git status
# if anything new:
git commit -am "chore: smoke test fixes"
```

---

## Notes for the implementer

- **Don't add features outside this plan.** No history page, no cron, no kickoff sync. (See spec §8.)
- **Preserve idempotency:** `recomputeMatchScores` is safe to re-run; the seed script is safe to re-run.
- **No new files unless listed.** If the spec didn't ask for it, don't write it.
- **If `matches` join syntax for `home_team`/`away_team` differs in this codebase**, grep for an existing select that joins teams via FK alias and copy the form. Don't invent.
- **TDD for `mapper` and `diff` only.** The server actions and UI are integration-level; verified via Step 11 smoke test.
