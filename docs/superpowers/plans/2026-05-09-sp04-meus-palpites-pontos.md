# SP-04 Meus palpites com pontos visíveis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Após o kickoff, o card de palpite em `/palpites` exibe o resultado oficial e a pontuação ganha pelo usuário com badge colorida por tier; header da fase mostra total de pontos visíveis.

**Architecture:** `MatchWithPrediction` ganha campo `score`. `getMatchesWithPredictions` faz uma terceira query a `prediction_scores` (já materializada por SP-02). UI condicional dentro do mesmo card: estados "Aguardando resultado", "Não palpitou", "Cancelado/Adiado", e badge de tier. Função pura `pickBadgeKind` testada.

**Tech Stack:** Next.js 16 RSC + client component · Supabase · vitest · shadcn (Badge) · TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-09-sp04-meus-palpites-pontos-design.md`
**Plano macro:** `docs/superpowers/specs/2026-05-09-plano-macro-regulamento.md`
**Depende de:** SP-01, SP-02. SP-03 não é pré-requisito mas convive bem.

**Notas para o executor:**
- npm. TS strict. vitest configurado. 77 tests passando antes de SP-04.
- shadcn `Badge` já existe; variants em uso no projeto: `default`, `secondary`, `outline`, `upcoming` (visto em `/inicio/page.tsx` e `/palpites/_components/match-prediction-card.tsx`).
- `MatchWithPrediction` está em `src/lib/types/prediction.ts` e estende `Match` (que já tem `home_score`, `away_score`, `status`).
- `revalidatePath("/palpites")` **NÃO** existe hoje em `updateMatch` nem `recomputeAllScores` — esta plano adiciona.
- Card hoje: `MatchPredictionCard` em `_components/match-prediction-card.tsx`. Cliente. Usa `opacity-60` quando `isClosed`. Esse opacity será removido (decisão Q6).

---

## File Structure

**Modificar:**
- `src/lib/types/prediction.ts` — adicionar `PredictionScore` e campo `score` em `MatchWithPrediction`.
- `src/app/(authenticated)/palpites/_lib/queries.ts` — terceira query a `prediction_scores` + merge.
- `src/app/(authenticated)/palpites/_components/match-prediction-card.tsx` — bloco condicional para estado encerrado, remoção do opacity, esconder footer.
- `src/app/(authenticated)/palpites/page.tsx` — total de pontos no header.
- `src/app/(authenticated)/admin/partidas/_actions.ts` — `revalidatePath("/palpites")`.
- `src/app/(authenticated)/admin/_actions.ts` — `revalidatePath("/palpites")`.

**Criar:**
- `src/app/(authenticated)/palpites/_components/score-badge.tsx` — `pickBadgeKind` puro + `<ScoreBadge>`.
- `src/app/(authenticated)/palpites/__tests__/score-badge.test.ts`.

---

## Task 1: Adicionar `score` ao tipo `MatchWithPrediction`

**Files:**
- Modify: `src/lib/types/prediction.ts`

- [ ] **Step 1: Atualizar tipos**

Conteúdo final do arquivo:

```ts
import type { Match, Team } from "@/lib/types/match";
import type { Tier } from "@/lib/scoring";

export interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  advances_team_id: string | null;
  advances_slot: "home" | "away" | null;
  created_at: string;
  updated_at: string;
}

export interface PredictionScore {
  points: number;
  tier: Tier;
}

export interface MatchWithPrediction extends Match {
  home_team: Pick<Team, "id" | "code" | "name" | "flag_url"> | null;
  away_team: Pick<Team, "id" | "code" | "name" | "flag_url"> | null;
  prediction: Prediction | null;
  score: PredictionScore | null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Esperado: o compilador aponta erro em `src/app/(authenticated)/palpites/_lib/queries.ts` (porque a função retorna objetos sem `score`). Isso é **esperado**; será corrigido na Task 2. Se houver outros usos de `MatchWithPrediction` fora de `/palpites`, anote em `STATUS: DONE_WITH_CONCERNS`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/prediction.ts
git commit -m "feat(types): add score field to MatchWithPrediction"
```

---

## Task 2: Estender `getMatchesWithPredictions` com `prediction_scores`

**Files:**
- Modify: `src/app/(authenticated)/palpites/_lib/queries.ts`

- [ ] **Step 1: Reescrever a função**

Conteúdo final:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MatchWithPrediction,
  PredictionScore,
} from "@/lib/types/prediction";
import type { Tier } from "@/lib/scoring";

export async function getMatchesWithPredictions(
  supabase: SupabaseClient,
  userId: string,
): Promise<MatchWithPrediction[]> {
  const matchesP = supabase
    .from("matches")
    .select(`
      *,
      home_team:home_team_id(id,code,name,flag_url),
      away_team:away_team_id(id,code,name,flag_url),
      prediction:predictions!left(
        id,user_id,match_id,home_score,away_score,advances_team_id,advances_slot,created_at,updated_at
      )
    `)
    .eq("predictions.user_id", userId)
    .order("kickoff_at", { ascending: true });

  const scoresP = supabase
    .from("prediction_scores")
    .select("prediction_id, points, tier")
    .eq("user_id", userId);

  const [matchesRes, scoresRes] = await Promise.all([matchesP, scoresP]);
  if (matchesRes.error) throw matchesRes.error;
  if (scoresRes.error) throw scoresRes.error;

  const scoreByPredId = new Map<string, PredictionScore>();
  const scoreRows =
    (scoresRes.data ?? []) as { prediction_id: string; points: number; tier: Tier }[];
  for (const r of scoreRows) {
    scoreByPredId.set(r.prediction_id, { points: r.points, tier: r.tier });
  }

  return (matchesRes.data ?? []).map((row: { prediction: unknown[] | null }) => {
    const predictionArr = row.prediction;
    const prediction =
      Array.isArray(predictionArr) && predictionArr.length > 0
        ? (predictionArr[0] as MatchWithPrediction["prediction"])
        : null;
    const score = prediction ? scoreByPredId.get(prediction.id) ?? null : null;
    return { ...(row as object), prediction, score };
  }) as MatchWithPrediction[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Esperado: limpo (o erro da Task 1 some).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authenticated)/palpites/_lib/queries.ts"
git commit -m "feat(palpites): include prediction scores in matches query"
```

---

## Task 3: `pickBadgeKind` puro + componente `ScoreBadge` (TDD)

**Files:**
- Test: `src/app/(authenticated)/palpites/__tests__/score-badge.test.ts`
- Create: `src/app/(authenticated)/palpites/_components/score-badge.tsx`

- [ ] **Step 1: Escrever testes falhos**

Criar `src/app/(authenticated)/palpites/__tests__/score-badge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickBadgeKind } from "@/app/(authenticated)/palpites/_components/score-badge";
import type { Prediction, PredictionScore } from "@/lib/types/prediction";

const aPrediction: Prediction = {
  id: "p1",
  user_id: "u1",
  match_id: "m1",
  home_score: 2,
  away_score: 1,
  advances_team_id: null,
  advances_slot: null,
  created_at: "",
  updated_at: "",
};

const aScore = (tier: PredictionScore["tier"], points: number): PredictionScore =>
  ({ tier, points });

describe("pickBadgeKind", () => {
  it("sem palpite → 'no_prediction' (mesmo se score for null)", () => {
    expect(pickBadgeKind(null, null)).toBe("no_prediction");
    expect(pickBadgeKind(aScore("exact", 7), null)).toBe("no_prediction");
  });

  it("palpite mas sem score (resultado pendente) → 'awaiting'", () => {
    expect(pickBadgeKind(null, aPrediction)).toBe("awaiting");
  });

  it("tier 'exact' → 'exact'", () => {
    expect(pickBadgeKind(aScore("exact", 7), aPrediction)).toBe("exact");
  });

  it("tier 'winner_or_draw' → 'winner_or_draw'", () => {
    expect(pickBadgeKind(aScore("winner_or_draw", 4), aPrediction)).toBe(
      "winner_or_draw",
    );
  });

  it("tier 'miss' → 'miss'", () => {
    expect(pickBadgeKind(aScore("miss", 0), aPrediction)).toBe("miss");
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test`
Esperado: falha com module-not-found.

- [ ] **Step 3: Criar `score-badge.tsx`**

Conteúdo:

```tsx
import { Badge } from "@/components/ui/badge";
import type { Prediction, PredictionScore } from "@/lib/types/prediction";

export type BadgeKind =
  | "no_prediction"
  | "awaiting"
  | "exact"
  | "winner_or_draw"
  | "miss";

export function pickBadgeKind(
  score: PredictionScore | null,
  prediction: Prediction | null,
): BadgeKind {
  if (prediction === null) return "no_prediction";
  if (score === null) return "awaiting";
  return score.tier;
}

export function ScoreBadge({
  score,
  prediction,
}: {
  score: PredictionScore | null;
  prediction: Prediction | null;
}) {
  const kind = pickBadgeKind(score, prediction);
  switch (kind) {
    case "exact":
      return (
        <Badge variant="upcoming">+{score!.points} · Placar exato</Badge>
      );
    case "winner_or_draw":
      return <Badge variant="secondary">+{score!.points} · Acertou</Badge>;
    case "miss":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          0 · Errou
        </Badge>
      );
    case "awaiting":
      return <Badge variant="outline">Aguardando</Badge>;
    case "no_prediction":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          0 · Não palpitou
        </Badge>
      );
  }
}
```

- [ ] **Step 4: Rodar testes**

Run: `npm test`
Esperado: 77 (anteriores) + 5 = **82 tests passing**.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Esperado: limpo. Se a variant `upcoming` não existir, peek em `src/components/ui/badge.tsx`; ajustar para a variant disponível mais próxima de "destaque positivo".

- [ ] **Step 6: Commit**

```bash
git add "src/app/(authenticated)/palpites/_components/score-badge.tsx" "src/app/(authenticated)/palpites/__tests__/score-badge.test.ts"
git commit -m "feat(palpites): pickBadgeKind and ScoreBadge component"
```

---

## Task 4: Atualizar `MatchPredictionCard` com bloco encerrado

**Files:**
- Modify: `src/app/(authenticated)/palpites/_components/match-prediction-card.tsx`

- [ ] **Step 1: Importar `ScoreBadge`**

No bloco de imports, junto aos demais:

```tsx
import { ScoreBadge } from "./score-badge";
```

- [ ] **Step 2: Remover `opacity-60` do `<Card>`**

Linha atual:
```tsx
<Card size="sm" className={cn(isClosed && "opacity-60")}>
```
Vira:
```tsx
<Card size="sm">
```

A função `cn` pode ficar sem uso aqui — manter import se for usado em outro lugar do arquivo, remover se não. Verificar.

- [ ] **Step 3: Renderizar `<CardFooter>` apenas quando aberto**

Linha atual (final do form):
```tsx
<CardFooter className="justify-end">
  <Button type="submit" size="sm" disabled={isClosed || isPending || !dirty}>
    {isPending ? "Salvando..." : savedTick ? "✓ Salvo" : "Salvar"}
  </Button>
</CardFooter>
```

Embrulhar em condicional:
```tsx
{!isClosed && (
  <CardFooter className="justify-end">
    <Button type="submit" size="sm" disabled={isPending || !dirty}>
      {isPending ? "Salvando..." : savedTick ? "✓ Salvo" : "Salvar"}
    </Button>
  </CardFooter>
)}
```

(`disabled={isPending || !dirty}` — sem `isClosed` porque o bloco já não renderiza nesse caso.)

- [ ] **Step 4: Esconder o fieldset "Quem se classifica?" quando encerrado**

Hoje:
```tsx
{knockoutNeedsAdvance ? (
  <CardContent className="pt-2">
    <fieldset>...</fieldset>
  </CardContent>
) : null}
```
Vira:
```tsx
{!isClosed && knockoutNeedsAdvance ? (
  <CardContent className="pt-2">
    <fieldset>...</fieldset>
  </CardContent>
) : null}
```

- [ ] **Step 5: Adicionar bloco condicional do estado encerrado**

Imediatamente antes do bloco do `<CardFooter>`:

```tsx
{isClosed && (
  <CardContent className="flex items-center justify-between gap-3 pt-0 pb-3">
    <span className="text-xs uppercase tracking-widest text-muted-foreground">
      {match.status === "cancelled"
        ? "Partida cancelada"
        : match.status === "postponed"
        ? "Partida adiada"
        : match.home_score === null || match.away_score === null
        ? "Aguardando resultado oficial"
        : "Resultado oficial"}
    </span>
    {match.home_score !== null &&
    match.away_score !== null &&
    match.status !== "cancelled" &&
    match.status !== "postponed" ? (
      <span
        className="font-heading text-lg tabular-nums"
        aria-label={`Resultado oficial: ${match.home_score} a ${match.away_score}`}
      >
        {match.home_score} <span className="opacity-50">×</span>{" "}
        {match.away_score}
      </span>
    ) : (
      <span aria-hidden />
    )}
    <ScoreBadge score={match.score} prediction={match.prediction} />
  </CardContent>
)}
```

- [ ] **Step 6: Atualizar `statusBadge` (header do card)**

Hoje:
```tsx
const statusBadge = isClosed ? (
  <Badge variant="secondary">Encerrado</Badge>
) : match.prediction && !dirty ? (
  <Badge variant="upcoming">Salvo</Badge>
) : null;
```

Manter como está. O `ScoreBadge` no rodapé complementa, não substitui.

- [ ] **Step 7: Typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Esperado: build passa. Lint: o erro pré-existente sobre `useState` em `match-prediction-card.tsx` continua presente (`react-hooks/purity`); não introduzir erros novos.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(authenticated)/palpites/_components/match-prediction-card.tsx"
git commit -m "feat(palpites): show result and points on closed match cards"
```

---

## Task 5: Total de pontos no header de `/palpites`

**Files:**
- Modify: `src/app/(authenticated)/palpites/page.tsx`

- [ ] **Step 1: Calcular total**

Antes do `return (...)`, depois de `const savedCount = ...`:

```ts
const totalPts = filtered.reduce(
  (acc, m) => acc + (m.score?.points ?? 0),
  0,
);
```

- [ ] **Step 2: Atualizar o `<Badge>` do header**

Linha atual:
```tsx
<Badge variant="secondary" className="h-7 px-3 text-xs">
  {savedCount}/{filtered.length} palpites
</Badge>
```

Vira:
```tsx
<Badge variant="secondary" className="h-7 px-3 text-xs">
  {savedCount}/{filtered.length} palpites · {totalPts} pts
</Badge>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Esperado: limpo.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authenticated)/palpites/page.tsx"
git commit -m "feat(palpites): show stage points total in header"
```

---

## Task 6: Revalidar `/palpites` quando scores mudam

**Files:**
- Modify: `src/app/(authenticated)/admin/partidas/_actions.ts`
- Modify: `src/app/(authenticated)/admin/_actions.ts`

- [ ] **Step 1: Em `partidas/_actions.ts`, dentro de `updateMatch`**

Junto aos `revalidatePath` existentes (após `recomputeMatchScores`), adicionar:

```ts
revalidatePath("/palpites");
```

Posição: após `revalidatePath("/classificacao")`.

- [ ] **Step 2: Em `admin/_actions.ts`, dentro de `recomputeAllScores`**

Junto aos `revalidatePath` existentes, adicionar:

```ts
revalidatePath("/palpites");
```

Posição: após `revalidatePath("/classificacao")`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Esperado: limpo.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authenticated)/admin/partidas/_actions.ts" "src/app/(authenticated)/admin/_actions.ts"
git commit -m "feat(admin): revalidate /palpites on score changes"
```

---

## Task 7: Verificação final

**Files:** nenhum.

- [ ] **Step 1: Suíte de testes**

Run: `npm test`
Esperado: ≥ **82 tests passing** (77 anteriores + 5 novos de `score-badge`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Esperado: limpo.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Esperado: nenhum **novo** erro em arquivos do SP-04.

- [ ] **Step 4: Build**

Run: `npm run build`
Esperado: build OK.

- [ ] **Step 5: Smoke E2E manual**

Pré-requisitos: SP-02 e SP-03 aplicadas; ao menos uma partida com resultado e ao menos um palpite do usuário corrente.

1. Logar como usuário com palpites salvos.
2. Acessar `/palpites`. Para a fase/grupo onde houver jogo passado:
   - Card encerrado **não está mais opaco**.
   - Mostra "Resultado oficial: H × A" e badge colorida (`+N · Placar exato`, `+N · Acertou`, ou `0 · Errou`).
   - Não há botão "Salvar".
   - Header mostra `X/Y palpites · Z pts`.
3. Para um jogo encerrado **sem palpite** (forçar via Studio: deletar o palpite do usuário em uma partida cujo kickoff já passou):
   - Card mostra "Aguardando resultado oficial" se admin ainda não lançou; ou
   - Card mostra badge "0 · Não palpitou" + linha de resultado, conforme o caso.
4. Para um jogo encerrado **sem resultado lançado**: badge "Aguardando".
5. Para um jogo com `status='cancelled'` ou `'postponed'`: linha "Partida cancelada/adiada" + badge "0 · Não palpitou" se sem palpite, ou "0 · Errou" se com palpite (porque SP-02 deletou o score → badge cai em "awaiting"; **nota**: este caso pode mostrar "Aguardando" e não "Errou", porque o score foi deletado intencionalmente em SP-02 Q4. Verificar e documentar como aceitável).
6. Admin altera um resultado em `/admin/partidas/[id]` e salva → após hard refresh em `/palpites`, badge e total refletem.
7. Admin clica "Recalcular pontuações" → idem reflexo em `/palpites`.

- [ ] **Step 6: Confirmar acessibilidade básica**

Inspetor → ver que o `aria-label="Resultado oficial: 2 a 1"` está presente onde renderizado.

---

## Done criteria

- [x] `MatchWithPrediction` ganhou campo `score`.
- [x] `getMatchesWithPredictions` lê `prediction_scores` em paralelo.
- [x] `pickBadgeKind` puro, com 5 testes.
- [x] `<ScoreBadge>` aplica variants por tier.
- [x] Card encerrado mostra resultado + badge; opacity removida; footer escondido.
- [x] Header da fase/grupo mostra `X/Y palpites · Z pts`.
- [x] `/palpites` revalida em `updateMatch` e `recomputeAllScores`.
- [x] `npm test`, `npx tsc --noEmit`, `npm run build` passam.
- [x] Smoke E2E manual concluído.
