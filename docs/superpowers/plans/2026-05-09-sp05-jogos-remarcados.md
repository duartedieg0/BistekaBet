# SP-05 Jogos remarcados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preservar o kickoff original quando uma partida é remarcada e exibir badge "Remarcado" com tooltip da data original em `/palpites` e `/admin/partidas`.

**Architecture:** Coluna `original_kickoff_at` em `matches` populada por trigger Postgres `before update` (à prova de bypass). Sem operação admin nova — editar `kickoff_at` no form continua sendo o gesto de remarcar. Componente `<RescheduledBadge>` renderiza em pontos específicos.

**Tech Stack:** Postgres trigger · Next.js RSC + client · shadcn (Badge) · TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-09-sp05-jogos-remarcados-design.md`
**Plano macro:** `docs/superpowers/specs/2026-05-09-plano-macro-regulamento.md`
**Depende de:** SP-02 (não bloqueia SP-05; só relação semântica via `status`).

**Notas para o executor:**
- Migrações SQL aplicadas **manualmente** no Supabase Studio (SQL Editor) com service role.
- `Match` está em `src/lib/types/match.ts`; `MatchWithTeams` (admin) em `src/app/(authenticated)/admin/partidas/_components/match-list.tsx` (extends Match — herda automaticamente).
- Queries `select *` em `getMatchesWithPredictions` e `partidas/page.tsx` puxam o novo campo sem mudança.
- Sem novos testes vitest. Validação é E2E manual.

---

## File Structure

**Criar:**
- `supabase/sql/010_matches_original_kickoff.sql` — coluna + trigger.
- `src/app/(authenticated)/palpites/_components/rescheduled-badge.tsx` — componente.

**Modificar:**
- `src/lib/types/match.ts` — adicionar `original_kickoff_at: string | null`.
- `src/app/(authenticated)/palpites/_components/match-prediction-card.tsx` — header com badge.
- `src/app/(authenticated)/admin/partidas/_components/match-list.tsx` — célula de horário com badge.
- `src/app/(authenticated)/admin/partidas/_components/match-form.tsx` — linha "Kickoff original" abaixo do input.

---

## Task 1: Migração SQL — coluna + trigger

**Files:**
- Create: `supabase/sql/010_matches_original_kickoff.sql`

- [ ] **Step 1: Criar arquivo de migração**

Conteúdo:

```sql
-- BistekaBet — preservar kickoff original quando partida é remarcada (SP-05).
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

alter table public.matches
  add column original_kickoff_at timestamptz;

create or replace function public.matches_record_original_kickoff()
returns trigger
language plpgsql as $$
begin
  if new.kickoff_at is distinct from old.kickoff_at
     and old.original_kickoff_at is null then
    new.original_kickoff_at := old.kickoff_at;
  end if;
  return new;
end $$;

create trigger matches_record_original_kickoff
  before update on public.matches
  for each row execute function public.matches_record_original_kickoff();
```

- [ ] **Step 2: Aplicar no Supabase Studio**

Studio → SQL Editor → colar → Run.

- [ ] **Step 3: Smoke do trigger**

```sql
-- Pegar uma partida qualquer
select id, kickoff_at, original_kickoff_at from public.matches limit 1;

-- Alterar o kickoff (substituir UUID e data)
update public.matches
   set kickoff_at = '2026-06-15 18:00:00+00'
 where id = '<uuid>';

-- Conferir que original_kickoff_at recebeu o valor anterior
select id, kickoff_at, original_kickoff_at from public.matches where id = '<uuid>';

-- Alterar de novo: original_kickoff_at NÃO muda
update public.matches set kickoff_at = '2026-06-16 18:00:00+00' where id = '<uuid>';
select id, kickoff_at, original_kickoff_at from public.matches where id = '<uuid>';
```

(Reverter os updates ao kickoff original real depois do smoke, se a partida estiver na tabela vigente.)

- [ ] **Step 4: Commit**

```bash
git add supabase/sql/010_matches_original_kickoff.sql
git commit -m "feat(db): preserve original_kickoff_at via trigger"
```

---

## Task 2: Atualizar tipo `Match`

**Files:**
- Modify: `src/lib/types/match.ts`

- [ ] **Step 1: Adicionar campo**

Adicionar dentro de `interface Match`, após `kickoff_at: string`:

```ts
  kickoff_at: string;
  original_kickoff_at: string | null;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo. As queries `select *` já cobrem o campo; nenhuma mudança extra necessária.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/match.ts
git commit -m "feat(types): add original_kickoff_at to Match"
```

---

## Task 3: Componente `RescheduledBadge`

**Files:**
- Create: `src/app/(authenticated)/palpites/_components/rescheduled-badge.tsx`

- [ ] **Step 1: Criar arquivo**

Conteúdo:

```tsx
import { Badge } from "@/components/ui/badge";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function RescheduledBadge({
  originalKickoff,
}: {
  originalKickoff: string | null;
}) {
  if (!originalKickoff) return null;
  return (
    <Badge
      variant="outline"
      className="text-muted-foreground"
      title={`Originalmente: ${fmt(originalKickoff)}`}
    >
      Remarcado
    </Badge>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authenticated)/palpites/_components/rescheduled-badge.tsx"
git commit -m "feat(ui): RescheduledBadge component"
```

---

## Task 4: Integrar no `MatchPredictionCard`

**Files:**
- Modify: `src/app/(authenticated)/palpites/_components/match-prediction-card.tsx`

- [ ] **Step 1: Importar**

No bloco de imports, junto aos demais:

```tsx
import { RescheduledBadge } from "./rescheduled-badge";
```

- [ ] **Step 2: Atualizar `<CardHeader>`**

Hoje:
```tsx
<CardHeader className="flex flex-row items-center justify-between gap-2">
  <span className="text-xs font-medium tabular text-muted-foreground">{kickoffLabel}</span>
  {statusBadge}
</CardHeader>
```

Vira:
```tsx
<CardHeader className="flex flex-row items-center justify-between gap-2">
  <div className="flex items-center gap-2">
    <span className="text-xs font-medium tabular text-muted-foreground">{kickoffLabel}</span>
    <RescheduledBadge originalKickoff={match.original_kickoff_at} />
  </div>
  {statusBadge}
</CardHeader>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authenticated)/palpites/_components/match-prediction-card.tsx"
git commit -m "feat(palpites): show Remarcado badge on match card header"
```

---

## Task 5: Integrar na lista admin

**Files:**
- Modify: `src/app/(authenticated)/admin/partidas/_components/match-list.tsx`

- [ ] **Step 1: Importar**

No topo, junto aos demais imports:

```tsx
import { RescheduledBadge } from "@/app/(authenticated)/palpites/_components/rescheduled-badge";
```

- [ ] **Step 2: Localizar a célula de horário**

Linha (atualmente em torno da linha 52):
```tsx
<TableCell>{new Date(m.kickoff_at).toLocaleString("pt-BR")}</TableCell>
```

Vira:
```tsx
<TableCell>
  <span className="inline-flex items-center gap-2">
    {new Date(m.kickoff_at).toLocaleString("pt-BR")}
    <RescheduledBadge originalKickoff={m.original_kickoff_at} />
  </span>
</TableCell>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo. `MatchWithTeams extends Match` herda `original_kickoff_at` automaticamente.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authenticated)/admin/partidas/_components/match-list.tsx"
git commit -m "feat(admin): show Remarcado badge in matches list"
```

---

## Task 6: Linha "Kickoff original" no form admin

**Files:**
- Modify: `src/app/(authenticated)/admin/partidas/_components/match-form.tsx`

- [ ] **Step 1: Localizar o bloco do `kickoff_at` input**

Atualmente:
```tsx
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
```

- [ ] **Step 2: Adicionar a linha condicional logo após o `<Input>`**

```tsx
<div>
  <Label htmlFor="kickoff_at">Início</Label>
  <Input
    id="kickoff_at"
    name="kickoff_at"
    type="datetime-local"
    defaultValue={toLocalInput(match.kickoff_at)}
    required
  />
  {match.original_kickoff_at && (
    <p className="text-xs text-muted-foreground mt-1">
      Kickoff original: {new Date(match.original_kickoff_at).toLocaleString("pt-BR")}
    </p>
  )}
</div>
```

- [ ] **Step 3: Typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authenticated)/admin/partidas/_components/match-form.tsx"
git commit -m "feat(admin): show original kickoff in match form"
```

---

## Task 7: Verificação final

**Files:** nenhum.

- [ ] **Step 1: Suíte completa**

Run: `npm test`
Expected: ≥ **82 tests passing** (sem novos; SP-05 não introduz tests).

- [ ] **Step 2: Typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Expected: limpo.

- [ ] **Step 3: Smoke E2E manual**

Pré-requisito: migração 010 aplicada.

1. Logar como admin → `/admin/partidas` → escolher uma partida que ainda não foi remarcada.
2. Editar `kickoff_at` para uma data futura diferente. Salvar.
3. Voltar à lista — célula de horário mostra "**Remarcado**" badge ao lado do novo horário.
4. Hover/long-press no badge → tooltip "Originalmente: dd/mm hh:mm" com a data **anterior**.
5. Abrir o form da mesma partida — abaixo do input de início, linha "Kickoff original: dd/mm hh:mm".
6. Editar `kickoff_at` de novo → tooltip continua mostrando a **primeira** data (não a segunda).
7. `/palpites` na fase/grupo da partida — card mostra badge "Remarcado" no header.
8. Studio: `select kickoff_at, original_kickoff_at from matches where id='...'` confere os valores.

- [ ] **Step 4: Sem regressões**

Visitar `/admin/usuarios`, `/admin/times`, `/inicio`, `/classificacao` — carregam normalmente. Card encerrado em `/palpites` continua mostrando resultado/badge de pontos (SP-04).

---

## Done criteria

- [x] Migração 010 aplicada com coluna + trigger.
- [x] `Match.original_kickoff_at: string | null` no tipo.
- [x] `<RescheduledBadge>` criado e reutilizado em 3 superfícies (palpites card, admin list, admin form).
- [x] Trigger captura apenas a **primeira** alteração de `kickoff_at`.
- [x] Tooltip mostra a data original em formato pt-BR.
- [x] `npm test`, `npx tsc --noEmit`, `npm run build` passam.
- [x] Smoke E2E manual concluído.
