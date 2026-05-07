# Gerenciamento de Jogos da Copa 2026 — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistir o fixture da Copa 2026 (`teams`, `matches`) com RLS e construir UI admin enxuta para registrar resultados (incluindo prorrogação/pênaltis) e definir confrontos do mata-mata.

**Architecture:** Schema Postgres no Supabase (DDL + seeds via SQL versionado, aplicado manualmente no Studio). UI admin em Next.js App Router com Server Actions, usando o cliente server-side do Supabase já existente (`src/lib/supabase/server.ts`). Validação com Zod no app, constraints SQL como fonte da verdade.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Supabase (Postgres + RLS), Zod, Tailwind v4, shadcn/ui (componentes já instalados em `src/components/ui/`), lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-07-gerenciamento-jogos-copa-2026-design.md`

**Verificação por tarefa:** projeto não tem framework de teste — usar `npx tsc --noEmit`, `npm run lint`, e smoke manual no browser (`npm run dev`) onde aplicável. Frequent commits.

**Convenção de rota:** `/admin/partidas` (link já existe em `admin-shell.tsx`) e `/admin/times` (novo). O spec dizia "jogos" mas o sidebar já aponta pra "partidas" — alinhar evita refatorar o shell.

---

## Estrutura de arquivos

**Criar:**
- `supabase/sql/002_init_teams_matches.sql` — DDL + RLS + triggers + índices
- `supabase/sql/003_seed_teams.sql` — 48 seleções (idempotente)
- `supabase/sql/004_seed_matches_group_stage.sql` — 72 jogos da fase de grupos
- `src/lib/types/match.ts` — types `Stage`, `MatchStatus`, `Team`, `Match`, helpers
- `src/lib/validation/match.ts` — Zod schemas
- `src/lib/match-status.ts` — derivação de status a partir de `kickoff_at`/placar
- `src/app/(authenticated)/admin/partidas/page.tsx` — lista por fase
- `src/app/(authenticated)/admin/partidas/[id]/page.tsx` — edição
- `src/app/(authenticated)/admin/partidas/_actions.ts` — `updateMatch`, `setMatchTeams`
- `src/app/(authenticated)/admin/partidas/_components/stage-tabs.tsx`
- `src/app/(authenticated)/admin/partidas/_components/match-list.tsx`
- `src/app/(authenticated)/admin/partidas/_components/match-form.tsx`
- `src/app/(authenticated)/admin/times/page.tsx`
- `src/app/(authenticated)/admin/times/_actions.ts`
- `src/app/(authenticated)/admin/times/_components/team-form.tsx`

**Modificar:**
- `src/app/(authenticated)/admin/_components/admin-shell.tsx` — adicionar item "Times"
- `package.json` — adicionar `zod`

---

## Task 1: Adicionar dependência zod

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar zod**

```bash
npm install zod
```

- [ ] **Step 2: Verificar instalação**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zod dependency"
```

---

## Task 2: SQL — DDL `teams` e `matches`

**Files:**
- Create: `supabase/sql/002_init_teams_matches.sql`

- [ ] **Step 1: Criar arquivo SQL**

```sql
-- BistekaBet — schema de teams e matches (Copa 2026)
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

-- =========================
-- Helper: trigger updated_at
-- =========================
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =========================
-- teams
-- =========================
create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  flag_url    text,
  group_code  text check (group_code is null or group_code ~ '^[A-L]$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

alter table public.teams enable row level security;

create policy "teams_select_authenticated" on public.teams
  for select to authenticated using (true);

create policy "teams_admin_write" on public.teams
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- =========================
-- matches
-- =========================
create table public.matches (
  id                uuid primary key default gen_random_uuid(),
  stage             text not null check (stage in (
                      'group','round_of_32','round_of_16',
                      'quarter','semi','third_place','final'
                    )),
  group_code        text check (group_code is null or group_code ~ '^[A-L]$'),
  bracket_position  int,
  home_team_id      uuid references public.teams(id) on delete restrict,
  away_team_id      uuid references public.teams(id) on delete restrict,
  kickoff_at        timestamptz not null,
  venue             text,
  status            text check (status is null or status in ('postponed','cancelled')),
  home_score        int check (home_score is null or home_score >= 0),
  away_score        int check (away_score is null or away_score >= 0),
  home_score_et     int check (home_score_et is null or home_score_et >= 0),
  away_score_et     int check (away_score_et is null or away_score_et >= 0),
  home_pens         int check (home_pens is null or home_pens >= 0),
  away_pens         int check (away_pens is null or away_pens >= 0),
  winner_team_id    uuid references public.teams(id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint matches_group_requires_group_code
    check ((stage = 'group') = (group_code is not null)),
  constraint matches_knockout_requires_position
    check (stage = 'group' or bracket_position is not null),
  constraint matches_distinct_teams
    check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id)
);

create index matches_stage_group_kickoff_idx on public.matches (stage, group_code, kickoff_at);
create index matches_stage_bracket_idx on public.matches (stage, bracket_position);
create index matches_kickoff_idx on public.matches (kickoff_at);
create index matches_home_team_idx on public.matches (home_team_id);
create index matches_away_team_idx on public.matches (away_team_id);

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

alter table public.matches enable row level security;

create policy "matches_select_authenticated" on public.matches
  for select to authenticated using (true);

create policy "matches_admin_write" on public.matches
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
```

- [ ] **Step 2: Aplicar manualmente no Supabase Studio**

Abrir Supabase Studio → SQL Editor → colar e executar `002_init_teams_matches.sql`. Verificar sem erros.

- [ ] **Step 3: Verificar RLS no Studio**

Em Database → Tables → `teams` e `matches`: confirmar que RLS está enabled e que as 4 policies aparecem.

- [ ] **Step 4: Commit**

```bash
git add supabase/sql/002_init_teams_matches.sql
git commit -m "feat(db): add teams and matches schema with RLS"
```

---

## Task 3: SQL — Seed das 48 seleções

**Files:**
- Create: `supabase/sql/003_seed_teams.sql`

- [ ] **Step 1: Criar arquivo de seed**

Estrutura idempotente. Preencher os 48 times com `code` (FIFA), `name` (PT-BR), `group_code` (A–L conforme sorteio oficial). `flag_url` pode ficar NULL e ser preenchido depois pela UI admin.

```sql
-- BistekaBet — seed das 48 seleções da Copa 2026
-- Aplicar manualmente no Supabase Studio.
-- Idempotente: re-rodar não duplica.

insert into public.teams (code, name, group_code) values
  ('CAN','Canadá','A'),
  ('MEX','México','A'),
  ('USA','Estados Unidos','A'),
  -- ... preencher os outros 45 conforme sorteio oficial da FIFA
  ('BRA','Brasil', null),
  ('ARG','Argentina', null)
  -- IMPORTANTE: ao executar, substituir esta lista pelos 48 times reais
  -- com group_code correto. Se o sorteio ainda não definiu o grupo de
  -- algum time, deixar group_code null e atualizar depois via UI admin.
on conflict (code) do nothing;
```

> Nota pro implementador: a ordem oficial dos grupos sai do sorteio FIFA. Buscar a versão mais recente antes de aplicar; se a feature está sendo desenvolvida antes do sorteio, usar a tabela atual da pré-classificação e atualizar via UI admin depois.

- [ ] **Step 2: Aplicar no Supabase Studio**

Executar SQL. Conferir: `select count(*) from public.teams;` deve retornar 48 (ou o número atual de classificados conhecidos).

- [ ] **Step 3: Commit**

```bash
git add supabase/sql/003_seed_teams.sql
git commit -m "feat(db): seed 48 selections for World Cup 2026"
```

---

## Task 4: SQL — Seed dos 72 jogos da fase de grupos

**Files:**
- Create: `supabase/sql/004_seed_matches_group_stage.sql`

- [ ] **Step 1: Criar arquivo de seed**

72 jogos = 12 grupos × 6 jogos cada. Estrutura:

```sql
-- BistekaBet — seed dos 72 jogos da fase de grupos
-- Aplicar manualmente no Supabase Studio APÓS 003_seed_teams.sql.
-- NÃO é idempotente — só rodar uma vez. Se precisar reaplicar, truncar primeiro.

with t as (
  select code, id from public.teams
)
insert into public.matches (
  stage, group_code, home_team_id, away_team_id, kickoff_at, venue
)
select 'group', g, h.id, a.id, k::timestamptz, v from (values
  -- Grupo A — 6 jogos
  ('A', 'MEX', 'XXX', '2026-06-11 20:00-03', 'Estádio Azteca, Cidade do México'),
  ('A', 'CAN', 'YYY', '2026-06-12 16:00-03', 'BMO Field, Toronto'),
  -- ... preencher 70 jogos restantes conforme calendário FIFA oficial
  ('L', 'AAA', 'BBB', '2026-06-26 22:00-03', 'Estádio Z')
) as fx(g, home_code, away_code, k, v)
join t h on h.code = fx.home_code
join t a on a.code = fx.away_code;
```

> Nota pro implementador: o calendário oficial sai junto do sorteio. Use a planilha mais recente da FIFA. Confira que (1) cada grupo tem exatamente 6 jogos, (2) cada time joga 3 vezes, (3) `kickoff_at` está com timezone correto.

- [ ] **Step 2: Aplicar no Supabase Studio**

Executar. Conferir:
- `select count(*) from public.matches where stage = 'group';` → 72
- `select group_code, count(*) from public.matches group by 1 order by 1;` → cada grupo com 6
- `select stage, count(*) from public.matches group by 1;` → só `group`

- [ ] **Step 3: Commit**

```bash
git add supabase/sql/004_seed_matches_group_stage.sql
git commit -m "feat(db): seed 72 group-stage matches"
```

---

## Task 5: Types e Zod schemas

**Files:**
- Create: `src/lib/types/match.ts`
- Create: `src/lib/validation/match.ts`
- Create: `src/lib/match-status.ts`

- [ ] **Step 1: Criar `src/lib/types/match.ts`**

```ts
export const STAGES = [
  "group",
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "third_place",
  "final",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  group: "Fase de Grupos",
  round_of_32: "32-avos",
  round_of_16: "16-avos",
  quarter: "Quartas de Final",
  semi: "Semifinais",
  third_place: "Disputa de 3º Lugar",
  final: "Final",
};

export const GROUP_CODES = ["A","B","C","D","E","F","G","H","I","J","K","L"] as const;
export type GroupCode = (typeof GROUP_CODES)[number];

export type ExplicitMatchStatus = "postponed" | "cancelled";
export type DerivedMatchStatus = "scheduled" | "live" | "finished";
export type MatchStatus = ExplicitMatchStatus | DerivedMatchStatus;

export interface Team {
  id: string;
  code: string;
  name: string;
  flag_url: string | null;
  group_code: GroupCode | null;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  stage: Stage;
  group_code: GroupCode | null;
  bracket_position: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  kickoff_at: string;
  venue: string | null;
  status: ExplicitMatchStatus | null;
  home_score: number | null;
  away_score: number | null;
  home_score_et: number | null;
  away_score_et: number | null;
  home_pens: number | null;
  away_pens: number | null;
  winner_team_id: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Criar `src/lib/match-status.ts`**

```ts
import type { Match, MatchStatus } from "@/lib/types/match";

export function deriveMatchStatus(match: Pick<Match, "status" | "kickoff_at" | "home_score">): MatchStatus {
  if (match.status) return match.status;
  if (match.home_score !== null) return "finished";
  if (new Date(match.kickoff_at).getTime() > Date.now()) return "scheduled";
  return "live";
}
```

- [ ] **Step 3: Criar `src/lib/validation/match.ts`**

```ts
import { z } from "zod";
import { STAGES, GROUP_CODES } from "@/lib/types/match";

export const stageSchema = z.enum(STAGES);
export const groupCodeSchema = z.enum(GROUP_CODES);

const optionalNonNegativeInt = z
  .union([z.number().int().nonnegative(), z.literal("").transform(() => null), z.null()])
  .transform((v) => (v === "" || v === null || v === undefined ? null : v));

export const updateMatchSchema = z
  .object({
    kickoff_at: z.string().min(1),
    venue: z.string().nullable().optional().transform((v) => v ?? null),
    home_team_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    away_team_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    home_score: optionalNonNegativeInt,
    away_score: optionalNonNegativeInt,
    home_score_et: optionalNonNegativeInt,
    away_score_et: optionalNonNegativeInt,
    home_pens: optionalNonNegativeInt,
    away_pens: optionalNonNegativeInt,
    winner_team_id: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    status: z.enum(["postponed", "cancelled"]).nullable().optional().transform((v) => v ?? null),
  })
  .superRefine((v, ctx) => {
    const has90 = v.home_score !== null && v.away_score !== null;
    const hasET = v.home_score_et !== null || v.away_score_et !== null;
    const hasPens = v.home_pens !== null || v.away_pens !== null;
    if (hasET && !has90) {
      ctx.addIssue({ code: "custom", message: "Prorrogação exige placar de 90 min preenchido." });
    }
    if (hasPens) {
      const etComplete = v.home_score_et !== null && v.away_score_et !== null;
      if (!etComplete) {
        ctx.addIssue({ code: "custom", message: "Pênaltis exigem prorrogação preenchida." });
      }
    }
    if (v.home_team_id && v.away_team_id && v.home_team_id === v.away_team_id) {
      ctx.addIssue({ code: "custom", message: "Mandante e visitante não podem ser o mesmo time." });
    }
  });

export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;

export const upsertTeamSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().regex(/^[A-Z]{3}$/u, "Código FIFA com 3 letras maiúsculas."),
  name: z.string().min(1),
  flag_url: z.string().url().nullable().optional().transform((v) => v ?? null),
  group_code: groupCodeSchema.nullable().optional().transform((v) => v ?? null),
});
export type UpsertTeamInput = z.infer<typeof upsertTeamSchema>;
```

- [ ] **Step 4: Verificar typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 erros.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/match.ts src/lib/validation/match.ts src/lib/match-status.ts
git commit -m "feat(types): add match types, status derivation and zod schemas"
```

---

## Task 6: Sidebar admin — adicionar "Times"

**Files:**
- Modify: `src/app/(authenticated)/admin/_components/admin-shell.tsx`

- [ ] **Step 1: Adicionar item "Times" ao array `ITEMS`**

Após o item `partidas`, antes de `usuarios`:

```ts
{ href: "/admin/times", label: "Times", icon: Trophy },
```

E adicionar `Trophy` ao import de `lucide-react`.

- [ ] **Step 2: Typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 3: Smoke manual**

`npm run dev`, abrir `/admin`, confirmar item "Times" aparecendo no sidebar.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/admin/_components/admin-shell.tsx
git commit -m "feat(admin): add Times link to sidebar"
```

---

## Task 7: Página `/admin/times` — listagem

**Files:**
- Create: `src/app/(authenticated)/admin/times/page.tsx`

- [ ] **Step 1: Implementar página de listagem**

Server Component. Lê `teams` ordenado por `group_code`, depois `name`. Renderiza tabela com colunas: bandeira, código, nome, grupo, ações (editar — link pra `?edit=<id>`). Usa `<AdminShell>` com breadcrumb `[{label: "Times"}]`.

```tsx
import { AdminShell } from "@/app/(authenticated)/admin/_components/admin-shell";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { TeamForm } from "./_components/team-form";
import type { Team } from "@/lib/types/match";

export default async function TimesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: teams, error } = await supabase
    .from("teams")
    .select("*")
    .order("group_code", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) throw error;

  const editing = sp.edit ? teams?.find((t) => t.id === sp.edit) : null;
  const showForm = Boolean(sp.new) || Boolean(editing);

  return (
    <AdminShell active="/admin/times" breadcrumbs={[{ label: "Times" }]}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl">Times</h1>
        <Button asChild>
          <Link href="/admin/times?new=1">Nova seleção</Link>
        </Button>
      </div>

      {showForm ? <TeamForm team={editing ?? null} /> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Grupo</TableHead>
            <TableHead className="w-32">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(teams as Team[] | null)?.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-mono">{t.code}</TableCell>
              <TableCell>{t.name}</TableCell>
              <TableCell>{t.group_code ?? "—"}</TableCell>
              <TableCell>
                <Link href={`/admin/times?edit=${t.id}`} className="text-sm underline">
                  Editar
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminShell>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

(Vai falhar até `TeamForm` existir — próxima task.)

- [ ] **Step 3: Pular commit** — junto com Task 8 abaixo.

---

## Task 8: `/admin/times` — formulário e action

**Files:**
- Create: `src/app/(authenticated)/admin/times/_components/team-form.tsx`
- Create: `src/app/(authenticated)/admin/times/_actions.ts`

- [ ] **Step 1: Criar `_actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { upsertTeamSchema } from "@/lib/validation/match";

export async function upsertTeam(formData: FormData) {
  const raw = {
    id: (formData.get("id") as string) || undefined,
    code: (formData.get("code") as string)?.toUpperCase(),
    name: formData.get("name") as string,
    flag_url: (formData.get("flag_url") as string) || null,
    group_code: (formData.get("group_code") as string) || null,
  };

  const parsed = upsertTeamSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const supabase = await createClient();
  if (parsed.data.id) {
    const { error } = await supabase
      .from("teams")
      .update({
        code: parsed.data.code,
        name: parsed.data.name,
        flag_url: parsed.data.flag_url,
        group_code: parsed.data.group_code,
      })
      .eq("id", parsed.data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("teams").insert({
      code: parsed.data.code,
      name: parsed.data.name,
      flag_url: parsed.data.flag_url,
      group_code: parsed.data.group_code,
    });
    if (error) throw error;
  }

  revalidatePath("/admin/times");
  redirect("/admin/times");
}
```

- [ ] **Step 2: Criar `team-form.tsx`**

Client component (`"use client"`). Form simples com campos `code`, `name`, `flag_url`, `group_code` (select A–L). Submete via Server Action `upsertTeam`. Inclui input hidden `id` quando editando.

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { GROUP_CODES, type Team } from "@/lib/types/match";
import { upsertTeam } from "../_actions";

export function TeamForm({ team }: { team: Team | null }) {
  return (
    <form action={upsertTeam} className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4 border rounded-md p-4 bg-muted/30">
      {team ? <input type="hidden" name="id" value={team.id} /> : null}
      <div>
        <Label htmlFor="code">Código FIFA</Label>
        <Input id="code" name="code" defaultValue={team?.code ?? ""} required maxLength={3} />
      </div>
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" defaultValue={team?.name ?? ""} required />
      </div>
      <div>
        <Label htmlFor="flag_url">URL da bandeira</Label>
        <Input id="flag_url" name="flag_url" type="url" defaultValue={team?.flag_url ?? ""} />
      </div>
      <div>
        <Label htmlFor="group_code">Grupo</Label>
        <select
          id="group_code"
          name="group_code"
          defaultValue={team?.group_code ?? ""}
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— sem grupo —</option>
          {GROUP_CODES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>
      <div className="md:col-span-4 flex gap-2">
        <Button type="submit">{team ? "Salvar" : "Criar"}</Button>
        <Button asChild variant="outline">
          <Link href="/admin/times">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 4: Smoke manual**

`npm run dev`, logar como admin, abrir `/admin/times`. Confirmar:
- Lista mostra os 48 times.
- "Nova seleção" abre o formulário e cria.
- "Editar" preenche o form e salva alterações.
- Tentar criar com código inválido (ex.: `"BR"`) → erro.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authenticated)/admin/times"
git commit -m "feat(admin): teams CRUD page with upsert action"
```

---

## Task 9: `/admin/partidas` — lista por fase (tabs)

**Files:**
- Create: `src/app/(authenticated)/admin/partidas/_components/stage-tabs.tsx`
- Create: `src/app/(authenticated)/admin/partidas/_components/match-list.tsx`
- Create: `src/app/(authenticated)/admin/partidas/page.tsx`

- [ ] **Step 1: Criar `stage-tabs.tsx`**

Client component que recebe `current` (stage atual) e `groupCode` (opcional) via props e renderiza links para cada fase. Em `group`, sub-tabs A–L.

```tsx
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { GROUP_CODES, STAGE_LABELS, STAGES, type Stage } from "@/lib/types/match";

export function StageTabs({ current, groupCode }: { current: Stage; groupCode?: string }) {
  return (
    <div className="space-y-3 mb-6">
      <div className="flex flex-wrap gap-2">
        {STAGES.map((s) => {
          const href = s === "group" ? "/admin/partidas?stage=group&group=A" : `/admin/partidas?stage=${s}`;
          const active = current === s;
          return (
            <Link
              key={s}
              href={href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm border",
                active ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
              )}
            >
              {STAGE_LABELS[s]}
            </Link>
          );
        })}
      </div>
      {current === "group" ? (
        <div className="flex flex-wrap gap-1">
          {GROUP_CODES.map((g) => {
            const active = groupCode === g;
            return (
              <Link
                key={g}
                href={`/admin/partidas?stage=group&group=${g}`}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-mono border",
                  active ? "bg-foreground text-background" : "bg-background hover:bg-muted"
                )}
              >
                {g}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Criar `match-list.tsx`**

Server-side rendering. Recebe lista de matches já carregada com teams via JOIN. Mostra tabela: data/hora, mandante, placar (com prorrogação/pênaltis se houver), visitante, status, ação "Editar" → `/admin/partidas/<id>`.

```tsx
import Link from "next/link";
import { deriveMatchStatus } from "@/lib/match-status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Match, Team } from "@/lib/types/match";

export type MatchWithTeams = Match & {
  home_team: Pick<Team, "id" | "code" | "name"> | null;
  away_team: Pick<Team, "id" | "code" | "name"> | null;
};

function formatScore(m: Match): string {
  if (m.home_score === null || m.away_score === null) return "—";
  const base = `${m.home_score} × ${m.away_score}`;
  if (m.home_pens !== null && m.away_pens !== null) {
    return `${base} (pen ${m.home_pens} × ${m.away_pens})`;
  }
  if (m.home_score_et !== null && m.away_score_et !== null) {
    return `${m.home_score_et} × ${m.away_score_et} (após prorrog.)`;
  }
  return base;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  live: "Ao vivo",
  finished: "Encerrado",
  postponed: "Adiado",
  cancelled: "Cancelado",
};

export function MatchList({ matches }: { matches: MatchWithTeams[] }) {
  if (!matches.length) {
    return <p className="text-sm text-muted-foreground">Nenhum jogo para esta fase ainda.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data/hora</TableHead>
          <TableHead>Mandante</TableHead>
          <TableHead className="text-center">Placar</TableHead>
          <TableHead>Visitante</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-24">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {matches.map((m) => {
          const status = deriveMatchStatus(m);
          return (
            <TableRow key={m.id}>
              <TableCell>{new Date(m.kickoff_at).toLocaleString("pt-BR")}</TableCell>
              <TableCell>{m.home_team?.name ?? "—"}</TableCell>
              <TableCell className="text-center font-mono">{formatScore(m)}</TableCell>
              <TableCell>{m.away_team?.name ?? "—"}</TableCell>
              <TableCell>{STATUS_LABEL[status]}</TableCell>
              <TableCell>
                <Link href={`/admin/partidas/${m.id}`} className="text-sm underline">Editar</Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Criar `page.tsx`**

```tsx
import { AdminShell } from "@/app/(authenticated)/admin/_components/admin-shell";
import { createClient } from "@/lib/supabase/server";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/types/match";
import { StageTabs } from "./_components/stage-tabs";
import { MatchList, type MatchWithTeams } from "./_components/match-list";

export default async function PartidasPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; group?: string }>;
}) {
  const sp = await searchParams;
  const stage = (STAGES as readonly string[]).includes(sp.stage ?? "")
    ? (sp.stage as Stage)
    : "group";
  const groupCode = stage === "group" ? (sp.group ?? "A") : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("matches")
    .select("*, home_team:home_team_id(id,code,name), away_team:away_team_id(id,code,name)")
    .eq("stage", stage)
    .order("kickoff_at", { ascending: true });

  if (stage === "group") {
    query = query.eq("group_code", groupCode!);
  } else {
    query = query.order("bracket_position", { ascending: true });
  }

  const { data, error } = await query;
  if (error) throw error;

  return (
    <AdminShell
      active="/admin/partidas"
      breadcrumbs={[{ label: "Partidas" }, { label: STAGE_LABELS[stage] }]}
    >
      <h1 className="font-heading text-2xl mb-6">Partidas</h1>
      <StageTabs current={stage} groupCode={groupCode} />
      <MatchList matches={(data ?? []) as MatchWithTeams[]} />
    </AdminShell>
  );
}
```

- [ ] **Step 4: Typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 5: Smoke manual**

Abrir `/admin/partidas`. Confirmar:
- Tabs de fase + sub-tabs A–L.
- Cada grupo mostra exatamente 6 jogos.
- Mata-mata mostra "Nenhum jogo para esta fase ainda" (esperado — banco só tem fase de grupos).
- Datas em PT-BR.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(authenticated)/admin/partidas/page.tsx" "src/app/(authenticated)/admin/partidas/_components"
git commit -m "feat(admin): matches list with stage tabs"
```

---

## Task 10: `/admin/partidas/[id]` — formulário de edição + action

**Files:**
- Create: `src/app/(authenticated)/admin/partidas/_actions.ts`
- Create: `src/app/(authenticated)/admin/partidas/_components/match-form.tsx`
- Create: `src/app/(authenticated)/admin/partidas/[id]/page.tsx`

- [ ] **Step 1: Criar `_actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateMatchSchema } from "@/lib/validation/match";

function parseIntOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function updateMatch(matchId: string, formData: FormData) {
  const raw = {
    kickoff_at: formData.get("kickoff_at") as string,
    venue: (formData.get("venue") as string) || null,
    home_team_id: (formData.get("home_team_id") as string) || null,
    away_team_id: (formData.get("away_team_id") as string) || null,
    home_score: parseIntOrNull(formData.get("home_score")),
    away_score: parseIntOrNull(formData.get("away_score")),
    home_score_et: parseIntOrNull(formData.get("home_score_et")),
    away_score_et: parseIntOrNull(formData.get("away_score_et")),
    home_pens: parseIntOrNull(formData.get("home_pens")),
    away_pens: parseIntOrNull(formData.get("away_pens")),
    winner_team_id: (formData.get("winner_team_id") as string) || null,
    status: (formData.get("status") as string) || null,
  };

  const parsed = updateMatchSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("matches").update(parsed.data).eq("id", matchId);
  if (error) throw error;

  revalidatePath("/admin/partidas");
  revalidatePath(`/admin/partidas/${matchId}`);
  redirect("/admin/partidas");
}
```

- [ ] **Step 2: Criar `match-form.tsx`**

Client component recebe `match` (tipado como `Match`) e `teams` (lista para selects). Renderiza:
- Kickoff (datetime-local), venue.
- Selects mandante/visitante (nullable em mata-mata).
- Bloco "Resultado": placar 90 min.
- Bloco condicional "Prorrogação" e "Pênaltis" (toggleados por estado local).
- Select `winner_team_id` (visível só em mata-mata).
- Select `status` (`""`, `postponed`, `cancelled`).

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Match, Team } from "@/lib/types/match";
import { updateMatch } from "../_actions";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MatchForm({ match, teams }: { match: Match; teams: Team[] }) {
  const isKnockout = match.stage !== "group";
  const [showET, setShowET] = useState(match.home_score_et !== null);
  const [showPens, setShowPens] = useState(match.home_pens !== null);

  const action = updateMatch.bind(null, match.id);

  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="kickoff_at">Início</Label>
          <Input
            id="kickoff_at"
            name="kickoff_at"
            type="datetime-local"
            defaultValue={toLocalInput(match.kickoff_at)}
            required
          />
        </div>
        <div>
          <Label htmlFor="venue">Sede</Label>
          <Input id="venue" name="venue" defaultValue={match.venue ?? ""} />
        </div>
        <TeamSelect name="home_team_id" label="Mandante" teams={teams} value={match.home_team_id} />
        <TeamSelect name="away_team_id" label="Visitante" teams={teams} value={match.away_team_id} />
      </div>

      <fieldset className="border rounded-md p-4">
        <legend className="px-2 text-sm font-semibold">Resultado (90 min)</legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="home_score">Mandante</Label>
            <Input id="home_score" name="home_score" type="number" min={0} defaultValue={match.home_score ?? ""} />
          </div>
          <div>
            <Label htmlFor="away_score">Visitante</Label>
            <Input id="away_score" name="away_score" type="number" min={0} defaultValue={match.away_score ?? ""} />
          </div>
        </div>
      </fieldset>

      {isKnockout ? (
        <>
          <div className="flex items-center gap-3">
            <input
              id="toggle-et"
              type="checkbox"
              checked={showET}
              onChange={(e) => setShowET(e.target.checked)}
            />
            <Label htmlFor="toggle-et">Houve prorrogação</Label>
          </div>
          {showET ? (
            <fieldset className="border rounded-md p-4">
              <legend className="px-2 text-sm font-semibold">Prorrogação (acumulado)</legend>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="home_score_et">Mandante</Label>
                  <Input id="home_score_et" name="home_score_et" type="number" min={0} defaultValue={match.home_score_et ?? ""} />
                </div>
                <div>
                  <Label htmlFor="away_score_et">Visitante</Label>
                  <Input id="away_score_et" name="away_score_et" type="number" min={0} defaultValue={match.away_score_et ?? ""} />
                </div>
              </div>
            </fieldset>
          ) : null}

          <div className="flex items-center gap-3">
            <input
              id="toggle-pens"
              type="checkbox"
              checked={showPens}
              onChange={(e) => setShowPens(e.target.checked)}
              disabled={!showET}
            />
            <Label htmlFor="toggle-pens">Decidiu nos pênaltis</Label>
          </div>
          {showPens ? (
            <fieldset className="border rounded-md p-4">
              <legend className="px-2 text-sm font-semibold">Pênaltis</legend>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="home_pens">Mandante</Label>
                  <Input id="home_pens" name="home_pens" type="number" min={0} defaultValue={match.home_pens ?? ""} />
                </div>
                <div>
                  <Label htmlFor="away_pens">Visitante</Label>
                  <Input id="away_pens" name="away_pens" type="number" min={0} defaultValue={match.away_pens ?? ""} />
                </div>
              </div>
            </fieldset>
          ) : null}

          <TeamSelect name="winner_team_id" label="Vencedor" teams={teams} value={match.winner_team_id} />
        </>
      ) : null}

      <div>
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={match.status ?? ""}
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— derivado automaticamente —</option>
          <option value="postponed">Adiado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      <div className="flex gap-2">
        <Button type="submit">Salvar</Button>
        <Button asChild variant="outline">
          <Link href="/admin/partidas">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}

function TeamSelect({
  name,
  label,
  teams,
  value,
}: {
  name: string;
  label: string;
  teams: Team[];
  value: string | null;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={value ?? ""}
        className="block w-full rounded-md border bg-background px-3 py-2 text-sm"
      >
        <option value="">— a definir —</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.code} — {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 3: Criar `[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { AdminShell } from "@/app/(authenticated)/admin/_components/admin-shell";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABELS, type Match, type Team } from "@/lib/types/match";
import { MatchForm } from "../_components/match-form";

export default async function EditMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [matchRes, teamsRes] = await Promise.all([
    supabase.from("matches").select("*").eq("id", id).maybeSingle(),
    supabase.from("teams").select("*").order("name", { ascending: true }),
  ]);

  if (matchRes.error) throw matchRes.error;
  if (teamsRes.error) throw teamsRes.error;
  if (!matchRes.data) notFound();

  const match = matchRes.data as Match;
  const teams = (teamsRes.data ?? []) as Team[];

  return (
    <AdminShell
      active="/admin/partidas"
      breadcrumbs={[
        { label: "Partidas", href: "/admin/partidas" },
        { label: STAGE_LABELS[match.stage] },
        { label: "Editar" },
      ]}
    >
      <h1 className="font-heading text-2xl mb-6">Editar partida</h1>
      <MatchForm match={match} teams={teams} />
    </AdminShell>
  );
}
```

- [ ] **Step 4: Typecheck + lint**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 5: Smoke manual — fluxo completo**

`npm run dev`, logar como admin, abrir `/admin/partidas`, clicar "Editar" num jogo de grupo. Confirmar:
- Form preenche kickoff/venue/teams corretamente.
- Salvar placar 2×1 → volta pra lista, status muda pra "Encerrado", placar aparece.
- Editar de novo, mudar pra adiado → status "Adiado".
- Limpar status → volta a derivar.
- (Após Task 11) Editar jogo de mata-mata: campos prorrogação/pênaltis aparecem, vencedor selecionável.

Validação de erro: tentar pênaltis sem prorrogação → action retorna erro.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(authenticated)/admin/partidas/_actions.ts" "src/app/(authenticated)/admin/partidas/_components/match-form.tsx" "src/app/(authenticated)/admin/partidas/[id]"
git commit -m "feat(admin): match edit form with result, ET and penalties"
```

---

## Task 11: Definir confronto pendente do mata-mata

**Files:**
- Modify: `src/app/(authenticated)/admin/partidas/_components/match-list.tsx` (já gerencia mata-mata vazio via mesma rota de edição — sem mudança necessária)

> Decisão: a UI já cobre isso porque o formulário de edição (`match-form.tsx`) permite escolher mandante/visitante (selects nullable). Para criar partidas de mata-mata, precisamos de uma forma de inserir registros vazios desse stage. Solução simples: SQL seed adicional ou UI separada.

- [ ] **Step 1: Criar `supabase/sql/005_seed_matches_knockout_skeleton.sql`**

Insere os 32 jogos do mata-mata como "shells" (sem times, com `kickoff_at` placeholder e `bracket_position` setado), permitindo ao admin preencher confrontos via UI conforme classificação.

```sql
-- 32 partidas de mata-mata com confrontos a definir
-- 16 oitavas (round_of_32 + round_of_16 conforme calendário) — Copa 2026 tem
-- 32-avos (16 jogos), 16-avos (8), Quartas (4), Semis (2), 3º (1), Final (1) = 32
-- Aplicar APÓS a fase de grupos.
insert into public.matches (stage, bracket_position, kickoff_at, venue) values
  ('round_of_32', 1, '2026-06-27 16:00-03', null),
  ('round_of_32', 2, '2026-06-27 20:00-03', null),
  -- ... preencher os outros 14 jogos do round_of_32 + 8 round_of_16
  --     + 4 quarter + 2 semi + 1 third_place + 1 final
  ('final',       1, '2026-07-19 16:00-03', null);
```

- [ ] **Step 2: Aplicar no Supabase Studio**

Conferir: `select stage, count(*) from matches where stage <> 'group' group by 1;` → totais corretos.

- [ ] **Step 3: Smoke manual**

Abrir `/admin/partidas?stage=round_of_32`. Confirmar 16 linhas com mandante/visitante "—". Editar primeiro: selecionar dois times, salvar, ver na lista.

- [ ] **Step 4: Commit**

```bash
git add supabase/sql/005_seed_matches_knockout_skeleton.sql
git commit -m "feat(db): seed knockout-stage match skeletons"
```

---

## Task 12: QA final + documentação

- [ ] **Step 1: Smoke manual completo**

- Login como admin: vê sidebar com Partidas + Times.
- Login como usuário comum: tenta `/admin/partidas` → redirecionado/bloqueado pelo layout admin (já existente).
- Direto na rede: tentar `update` em `matches` como usuário comum → RLS bloqueia (testar via DevTools/SQL editor).
- Edita um jogo da fase de grupos: placar simples salva.
- Edita uma "shell" do mata-mata: define times + kickoff + placar com prorrogação + pênaltis.
- Marca um jogo como `postponed`, depois limpa, status volta a derivar.

- [ ] **Step 2: Build de produção**

```bash
npm run build
```

Expected: build passa sem erros. Resolve qualquer erro de tipo ou lint que aparecer.

- [ ] **Step 3: Atualizar `CLAUDE.md`/`AGENTS.md` se necessário**

Se houver convenções novas (ex.: padrão de Server Actions, organização de `_actions.ts`/`_components/`), adicionar nota curta.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore(admin): finalize matches management feature"
```

---

## Resumo de decisões

- Rota `partidas` (não `jogos`) — alinha com `admin-shell.tsx` existente.
- Sem framework de teste — verificação por `tsc`, `eslint` e smoke manual. Quando o projeto adicionar Vitest/Playwright, retroagir testes pra `match-status.ts`, `validation/match.ts` e Server Actions.
- Mata-mata começa como "shells" no banco (Task 11) — UI admin define os times conforme classificação. Alternativa rejeitada: criar partidas via UI (mais código, sem ganho real porque os 32 jogos são fixos em estrutura).
- `winner_team_id` é input manual no formulário, não derivação automática. Simples agora; pode evoluir pra cálculo automático na próxima feature de palpites.
