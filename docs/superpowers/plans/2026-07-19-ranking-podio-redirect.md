# Ranking: Pódio + destaque 4º–10º + redirect na final — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformular a página Ranking (`/classificacao`) com um pódio dos 3 primeiros no topo e uma lista do 4º em diante com a faixa 4º–10º destacada, e redirecionar `/inicio` → `/classificacao` automaticamente quando a final estiver decidida.

**Architecture:** Split IO/puro para a detecção da final (`final-status-core.ts` puro + `final-status.ts` server-only), consumido por `/inicio` (async) via `redirect`. Página Ranking recompõe-se em componentes isolados e presentacionais (`RankingPodium`, `RankingList`) + extrações compartilhadas (`MEDAL_COLORS`, `PremiacaoNote`). `loadRanking()` e a matemática de ranking permanecem intactas. O preview da home (`RankingTable`) fica visualmente idêntico.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript, Tailwind v4, Base UI (`Avatar`), Supabase (server client), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-19-ranking-podio-redirect-design.md`

> **Convenção do repo (importante):** testes cobrem **funções puras** (Vitest); **não há testes de componente**. Por isso o único TDD real aqui é o do predicado puro `finalDecidedFromRow`. Refactors e componentes presentacionais são verificados por `npm test` + `npm run lint` + inspeção visual manual.

> **AGENTS.md:** este Next.js tem convenções próprias. O padrão de `redirect` já foi confirmado em `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`: importar de `next/navigation`, funciona em Server Component, **throws** (chamar fora de try/catch). Reler se surgir dúvida.

---

## File Structure

**Criar:**
- `src/lib/scoring/medal.ts` — mapa `MEDAL_COLORS` (rank → classe de cor), compartilhado.
- `src/app/(authenticated)/_components/premiacao-note.tsx` — nota "Top 3 levam camisa…", compartilhada (home preview + página Ranking).
- `src/lib/matches/final-status-core.ts` — `finalDecidedFromRow(row)` puro.
- `src/lib/matches/final-status.ts` — `isFinalDecided()` server-only (IO).
- `src/lib/matches/__tests__/final-status-core.test.ts` — unit do predicado.
- `src/app/(authenticated)/classificacao/_components/ranking-podium.tsx` — pódio (top 3).
- `src/app/(authenticated)/classificacao/_components/ranking-list.tsx` — lista do 4º em diante + destaque 4º–10º.

**Modificar:**
- `src/app/(authenticated)/inicio/_components/ranking-table.tsx` — importar `MEDAL_COLORS` e `PremiacaoNote` (remover cópias locais). Visual inalterado.
- `src/app/(authenticated)/inicio/page.tsx` — `async` + `redirect` quando final decidida.
- `src/app/(authenticated)/classificacao/page.tsx` — compor pódio + lista + nota, `<h1>` "Ranking", estado vazio.

---

## Task 1: Extrair `MEDAL_COLORS` para módulo compartilhado

**Files:**
- Create: `src/lib/scoring/medal.ts`
- Modify: `src/app/(authenticated)/inicio/_components/ranking-table.tsx:13-17`

Refactor puro (sem mudança de comportamento). O preview da home continua idêntico.

- [ ] **Step 1: Criar `src/lib/scoring/medal.ts`**

```ts
// Cores de medalha por colocação (1º ouro, 2º prata, 3º bronze).
// Compartilhado entre o pódio do Ranking (/classificacao) e o preview da home.
export const MEDAL_COLORS: Record<number, string> = {
  1: "text-yellow-500",
  2: "text-gray-400",
  3: "text-amber-700",
};
```

- [ ] **Step 2: Atualizar `ranking-table.tsx` para importar do módulo**

Remover o `const MEDAL_COLORS` local (linhas 13-17) e adicionar o import no topo, junto aos demais:

```tsx
import { MEDAL_COLORS } from "@/lib/scoring/medal";
```

O resto do arquivo (`RankCell`, `RankingTable`) permanece igual — `MEDAL_COLORS[rank]` continua resolvendo.

- [ ] **Step 3: Verificar lint + testes**

Run: `npm run lint && npm test`
Expected: sem novos erros; todos os testes passam (nenhum teste referencia `MEDAL_COLORS` diretamente).

- [ ] **Step 4: Commit**

```bash
git add src/lib/scoring/medal.ts "src/app/(authenticated)/inicio/_components/ranking-table.tsx"
git commit -m "refactor(ranking): extrai MEDAL_COLORS para modulo compartilhado"
```

---

## Task 2: Extrair `PremiacaoNote` compartilhado

**Files:**
- Create: `src/app/(authenticated)/_components/premiacao-note.tsx`
- Modify: `src/app/(authenticated)/inicio/_components/ranking-table.tsx:70-79`

Move a nota de premiação do rodapé do `RankingTable` para um componente reutilizável. Home preview continua idêntico.

- [ ] **Step 1: Criar `src/app/(authenticated)/_components/premiacao-note.tsx`**

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";

export function PremiacaoNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Top 3 levam uma camisa da Seleção Brasileira.{" "}
      <Link
        href="/regulamento#premiacao"
        className="underline hover:text-foreground"
      >
        Ver premiação no regulamento
      </Link>
      .
    </p>
  );
}
```

- [ ] **Step 2: Substituir a nota inline no `RankingTable`**

Em `ranking-table.tsx`, trocar o `<p className="mt-3 text-xs …">…</p>` (linhas 70-79) por:

```tsx
<PremiacaoNote className="mt-3" />
```

Adicionar o import: `import { PremiacaoNote } from "@/app/(authenticated)/_components/premiacao-note";`
Remover o import de `Link` **se** deixar de ser usado no arquivo (conferir: após a troca, `Link` não é mais referenciado no `ranking-table.tsx` → remover para não quebrar o lint de imports não usados).

- [ ] **Step 3: Verificar lint + testes**

Run: `npm run lint && npm test`
Expected: sem erros de import não usado; testes passam.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authenticated)/_components/premiacao-note.tsx" "src/app/(authenticated)/inicio/_components/ranking-table.tsx"
git commit -m "refactor(ranking): extrai PremiacaoNote compartilhado"
```

---

## Task 3: Predicado puro + IO da detecção da final (TDD)

**Files:**
- Create: `src/lib/matches/final-status-core.ts`
- Create: `src/lib/matches/__tests__/final-status-core.test.ts`
- Create: `src/lib/matches/final-status.ts`

Segue o split do repo (`ranking-core.ts` puro vs `ranking.ts` server-only): o teste importa só o core, sem `server-only`.

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/matches/__tests__/final-status-core.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { finalDecidedFromRow } from "@/lib/matches/final-status-core";

describe("finalDecidedFromRow", () => {
  it("null (nenhuma final encontrada) → false", () => {
    expect(finalDecidedFromRow(null)).toBe(false);
  });

  it("final ainda sem vencedor → false", () => {
    expect(finalDecidedFromRow({ winner_team_id: null })).toBe(false);
  });

  it("final decidida (com winner_team_id) → true", () => {
    expect(finalDecidedFromRow({ winner_team_id: "team-uuid" })).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/lib/matches/__tests__/final-status-core.test.ts`
Expected: FAIL — módulo `final-status-core` não existe.

- [ ] **Step 3: Implementar o core puro**

`src/lib/matches/final-status-core.ts`:

```ts
/**
 * A final está decidida quando a partida `stage='final'` tem vencedor.
 * `winner_team_id` é o marcador definitivo (cobre prorrogação/pênaltis).
 */
export function finalDecidedFromRow(
  row: { winner_team_id: string | null } | null,
): boolean {
  return row?.winner_team_id != null;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/lib/matches/__tests__/final-status-core.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Implementar a casca de IO**

`src/lib/matches/final-status.ts`:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { finalDecidedFromRow } from "./final-status-core";

/**
 * true quando a partida `stage='final'` já tem vencedor.
 * Fail-safe: qualquer erro (inclusive múltiplas linhas 'final', que fazem o
 * .maybeSingle() popular `error`) → false, ou seja, NÃO redireciona.
 * "Múltiplas finais → sem redirect" é degradação intencional: sinaliza problema
 * de dado. NÃO mascarar com `.limit(1)`.
 */
export async function isFinalDecided(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("matches")
      .select("winner_team_id")
      .eq("stage", "final")
      .maybeSingle<{ winner_team_id: string | null }>();
    if (error) return false;
    return finalDecidedFromRow(data);
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: Verificar lint + suíte completa**

Run: `npm run lint && npm test`
Expected: sem erros; todos os testes passam (inclusive os 3 novos).

- [ ] **Step 7: Commit**

```bash
git add src/lib/matches/
git commit -m "feat(ranking): detecta final decidida (finalDecidedFromRow + isFinalDecided)"
```

---

## Task 4: Redirect em `/inicio` quando a final estiver decidida

**Files:**
- Modify: `src/app/(authenticated)/inicio/page.tsx`

`redirect` throws, então fica fora de try/catch; `isFinalDecided()` já encapsula o try internamente.

- [ ] **Step 1: Tornar a página `async` e adicionar o redirect**

Editar `src/app/(authenticated)/inicio/page.tsx`:
- Adicionar imports no topo:

```tsx
import { redirect } from "next/navigation";
import { isFinalDecided } from "@/lib/matches/final-status";
```

- Trocar a assinatura e adicionar a checagem como primeira instrução do corpo:

```tsx
export default async function InicioPage() {
  if (await isFinalDecided()) redirect("/classificacao");

  return (
    // …JSX existente inalterado…
  );
}
```

- [ ] **Step 2: Verificar tipos + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem novos erros. (Se `tsc --noEmit` acusar erros pré-existentes não relacionados, ignorar; focar em `inicio/page.tsx`.)

- [ ] **Step 3: Verificação manual (dev)**

Run: `npm run dev`
- Com a final **sem** `winner_team_id`: acessar `/inicio` renderiza a home normalmente (sem redirect).
- Preencher `winner_team_id` da partida `stage='final'` (via admin/import ou SQL de staging) e recarregar `/inicio`: deve redirecionar para `/classificacao`.
- Reverter o `winner_team_id` para `null` ao final do teste, se em ambiente compartilhado.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authenticated)/inicio/page.tsx"
git commit -m "feat(ranking): redireciona /inicio para /classificacao quando a final e decidida"
```

---

## Task 5: Componente `RankingPodium`

**Files:**
- Create: `src/app/(authenticated)/classificacao/_components/ranking-podium.tsx`

Server component presentacional (renderiza o `Avatar` client — permitido). Ordem visual **2º | 1º | 3º**, 1º ao centro/realçado. Sem teste de componente (convenção do repo).

- [ ] **Step 1: Criar o componente**

```tsx
import { Crown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/app/(authenticated)/_components/avatar-fallback";
import { MEDAL_COLORS } from "@/lib/scoring/medal";
import { cn } from "@/lib/utils";
import type { RankingRow } from "@/lib/scoring/ranking-core";

function PodiumCard({ row, champion }: { row: RankingRow; champion: boolean }) {
  const medal = MEDAL_COLORS[row.rank] ?? "text-muted-foreground";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-2 rounded-xl border border-border bg-card px-3 text-center",
        champion ? "pt-5 pb-8 ring-2 ring-yellow-500/40" : "pt-4 pb-4",
      )}
    >
      {champion && <Crown className="size-5 text-yellow-500" aria-hidden />}
      <Avatar
        className={cn(
          "ring-2 ring-primary/20",
          champion ? "size-16 sm:size-20" : "size-12 sm:size-14",
        )}
      >
        {row.avatar_url ? <AvatarImage src={row.avatar_url} alt="" /> : null}
        <AvatarFallback className="font-heading uppercase">
          {getInitials(row.display_name)}
        </AvatarFallback>
      </Avatar>
      <span
        className={cn(
          "font-heading tabular-nums",
          medal,
          champion ? "text-2xl" : "text-xl",
        )}
      >
        {row.rank}º
      </span>
      <p className="min-w-0 max-w-full truncate font-medium">
        {row.display_name}
      </p>
      <p
        className={cn(
          "font-heading tabular-nums",
          champion ? "text-3xl" : "text-2xl",
        )}
      >
        {row.total_points}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          pts
        </span>
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {row.exacts_total} exatos
      </p>
    </div>
  );
}

// rows: top 3 na ordem de classificação (índice 0 = 1º). Render na ordem
// visual 2º | 1º | 3º, com o 1º (índice 0) ao centro e realçado.
const VISUAL_ORDER = [1, 0, 2];

export function RankingPodium({ rows }: { rows: RankingRow[] }) {
  return (
    <section
      aria-label="Pódio — top 3"
      className="flex items-end justify-center gap-3 sm:gap-6"
    >
      {VISUAL_ORDER.map((idx) => {
        const row = rows[idx];
        if (!row) return null;
        return <PodiumCard key={row.user_id} row={row} champion={idx === 0} />;
      })}
    </section>
  );
}
```

Notas:
- **Empates:** a colocação exibida vem de `row.rank` (ver §6 do spec) — dois "1º" aparecem honestamente.
- **Mobile:** `min-w-0` + `truncate` no nome evitam estouro em 3 colunas estreitas.
- Não passamos `size` no `Avatar` (deixamos as classes `size-*` explícitas vencerem via tailwind-merge).

- [ ] **Step 2: Verificar tipos + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authenticated)/classificacao/_components/ranking-podium.tsx"
git commit -m "feat(ranking): componente RankingPodium (top 3 em podio)"
```

---

## Task 6: Componente `RankingList`

**Files:**
- Create: `src/app/(authenticated)/classificacao/_components/ranking-list.tsx`

Lista do 4º em diante; destaque quando `rank <= 10`. Sem teste de componente.

- [ ] **Step 1: Criar o componente**

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RankingRow } from "@/lib/scoring/ranking-core";

// rows: participantes a partir do 4º (a página passa rows.slice(3)).
// Destaque na faixa 4º–10º via rank <= 10 (a lista já começa após o pódio).
export function RankingList({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) return null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-right">#</TableHead>
          <TableHead>Participante</TableHead>
          <TableHead className="w-20 text-right">Pontos</TableHead>
          <TableHead className="w-20 text-right">Exatos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const highlighted = r.rank <= 10;
          return (
            <TableRow
              key={r.user_id}
              className={cn(
                highlighted &&
                  "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary",
              )}
            >
              <TableCell
                className={cn(
                  "text-right font-semibold tabular-nums",
                  highlighted && "text-primary",
                )}
              >
                {r.rank}
              </TableCell>
              <TableCell className="font-medium">{r.display_name}</TableCell>
              <TableCell className="text-right tabular-nums">
                {r.total_points}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.exacts_total}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Verificar tipos + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem novos erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authenticated)/classificacao/_components/ranking-list.tsx"
git commit -m "feat(ranking): componente RankingList (4o em diante, faixa 4-10 destacada)"
```

---

## Task 7: Recompor a página `/classificacao`

**Files:**
- Modify: `src/app/(authenticated)/classificacao/page.tsx`

Compõe pódio + lista + nota, `<h1>` "Ranking", estado vazio próprio.

- [ ] **Step 1: Reescrever a página**

```tsx
import { loadRanking } from "@/lib/scoring/ranking";
import { PremiacaoNote } from "@/app/(authenticated)/_components/premiacao-note";
import { RankingPodium } from "./_components/ranking-podium";
import { RankingList } from "./_components/ranking-list";

export default async function ClassificacaoPage() {
  const rows = await loadRanking();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Bolão Copa 2026
        </p>
        <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
          Ranking
        </h1>
        <p className="text-muted-foreground">
          {rows.length} {rows.length === 1 ? "participante" : "participantes"}.
          Atualizada conforme resultados oficiais são registrados.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          A classificação aparecerá aqui assim que os primeiros resultados forem
          registrados.
        </p>
      ) : (
        <>
          <RankingPodium rows={rows.slice(0, 3)} />
          <RankingList rows={rows.slice(3)} />
          <PremiacaoNote />
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verificar tipos + lint + testes**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sem novos erros; testes passam.

- [ ] **Step 3: Verificação manual (dev)**

Run: `npm run dev` → acessar `/classificacao`:
- Pódio no topo com 2º | 1º | 3º, 1º realçado (coroa/anel/avatar maior), mostrando avatar/nome/pontos/exatos.
- Lista começa no 4º; linhas 4º–10º com fundo destacado + número em cor primária; 11º+ neutro.
- Nota de premiação abaixo da lista.
- (Opcional) Estado vazio: com 0 participantes, aparece a mensagem placeholder.
- Conferir mobile (largura ~375px): pódio em 3 colunas sem estouro de nome.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authenticated)/classificacao/page.tsx"
git commit -m "feat(ranking): pagina Ranking com podio + lista destacada"
```

---

## Task 8: Verificação final integrada

**Files:** nenhum (apenas verificação).

- [ ] **Step 1: Suíte completa + lint + build de tipos**

Run: `npm test && npm run lint && npm run build`
Expected: testes verdes, lint limpo, build conclui sem erros de tipo.

- [ ] **Step 2: Smoke manual do fluxo completo**

Com a final preenchida em staging:
- `/inicio` redireciona para `/classificacao`.
- Preview de ranking na home (quando acessível sem redirect, ex.: final ainda não decidida) permanece visualmente idêntico ao anterior.
- Página Ranking exibe pódio + faixa 4º–10º corretamente.

- [ ] **Step 3: Calibração visual (opcional, com o usuário)**

Ajustar, se desejado: intensidade do destaque (`bg-primary/5` ↔ `bg-primary/10`), tamanho dos avatares do pódio, realce do 1º. Alterações só de classe Tailwind.

---

## Notas de calibração (esperadas na revisão visual)
- Intensidade da faixa 4º–10º (`bg-primary/5` vs `/10`, filete `border-l-primary`).
- Tamanho/realce do pódio (avatar do campeão, coroa, anel dourado).
- Tipografia dos números (pontos) no pódio.
</content>
