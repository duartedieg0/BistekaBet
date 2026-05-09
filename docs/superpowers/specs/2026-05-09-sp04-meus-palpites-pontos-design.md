# SP-04 · Meus palpites com pontos visíveis — Design

**Data:** 2026-05-09
**Plano macro:** [`2026-05-09-plano-macro-regulamento.md`](./2026-05-09-plano-macro-regulamento.md)
**Depende de:** SP-01 (engine), SP-02 (`prediction_scores` materializada).
**Cláusulas cobertas:** §3, §5, §11 (UX no nível do usuário).

---

## 1. Objetivo

Após o kickoff de uma partida, o `MatchPredictionCard` em `/palpites` mostra:
- o resultado oficial do tempo normal (§5),
- a pontuação ganha pelo usuário com badge colorida por tier,
- estados especiais para "aguardando resultado", "não palpitou" e "partida cancelada/adiada".

O header da página passa a exibir o **total de pontos da fase/grupo visível**.

## 2. Não-objetivos

- Notificações ("você ganhou X pontos no jogo Y").
- Página separada de histórico (decisão Q1-A: tudo no mesmo card).
- Visão "rodada" por dia/janela.
- Reabertura de palpites — SP-05.
- Recálculo no client (single source of truth = `prediction_scores`).

## 3. Decisões de design

| ID | Decisão | Justificativa |
|---|---|---|
| Q1 | Mostrar resultado e pontos **dentro do `MatchPredictionCard`** quando `isClosed` | Reusa navegação por tabs; opacidade vira conteúdo útil; menor superfície |
| Q2 | Badge colorida por tier + estados especiais "Aguardando resultado" e "Não palpitou" | Feedback emocional rápido; cobre §3 e estados pré-resultado |
| Q3 | Header da fase/grupo: `X/Y palpites · Z pts` | Feedback contextualizado; total geral fica em `/classificacao` |
| Q4 | Pontos vêm de `prediction_scores` (SP-02), nunca recalculados no client | Engine é single source of truth; consistência com ranking |
| Q5 | `MatchWithPrediction` ganha campo opcional `score` (não quebra outros consumidores) | Backwards-compat; outros usuários do tipo continuam funcionando |
| Q6 | Remover `opacity-60` do card encerrado | Conteúdo novo (resultado + badge) precisa estar legível; "encerrado" já é comunicado por inputs disabled e ausência de "Salvar" |
| Q7 | `<CardFooter>` (botão "Salvar") **não renderiza** quando `isClosed` | Evita footer vazio |
| Q8 | Função pura `pickBadgeKind(score, prediction)` testada em vitest | Garante precedência (no_prediction → awaiting → tier) |

## 4. Arquitetura

### 4.1 Tipo

`src/lib/types/prediction.ts`:

```ts
import type { Match, Team } from "@/lib/types/match";
import type { Tier } from "@/lib/scoring";

export interface Prediction { /* ... como hoje ... */ }

export interface PredictionScore {
  points: number;
  tier: Tier;
}

export interface MatchWithPrediction extends Match {
  home_team: Pick<Team, "id" | "code" | "name" | "flag_url"> | null;
  away_team: Pick<Team, "id" | "code" | "name" | "flag_url"> | null;
  prediction: Prediction | null;
  score: PredictionScore | null; // NOVO
}
```

### 4.2 Query estendida

`src/app/(authenticated)/palpites/_lib/queries.ts` ganha terceira leitura paralela:

```ts
export async function getMatchesWithPredictions(supabase, userId): Promise<MatchWithPrediction[]> {
  const matchesAndPredictionsP = supabase.from("matches").select(`...`).order("kickoff_at", { ascending: true });
  const scoresP = supabase
    .from("prediction_scores")
    .select("prediction_id, points, tier")
    .eq("user_id", userId);

  const [matchesRes, scoresRes] = await Promise.all([matchesAndPredictionsP, scoresP]);
  if (matchesRes.error) throw matchesRes.error;
  if (scoresRes.error) throw scoresRes.error;

  const scoreByPredId = new Map<string, PredictionScore>();
  for (const r of (scoresRes.data ?? []) as { prediction_id: string; points: number; tier: Tier }[]) {
    scoreByPredId.set(r.prediction_id, { points: r.points, tier: r.tier });
  }

  return (matchesRes.data ?? []).map((row: any) => {
    const prediction = Array.isArray(row.prediction) && row.prediction.length > 0 ? row.prediction[0] : null;
    const score = prediction ? scoreByPredId.get(prediction.id) ?? null : null;
    return { ...row, prediction, score };
  }) as MatchWithPrediction[];
}
```

A RLS pública de `prediction_scores` (SP-02 Q3) permite o read; `.eq("user_id", userId)` é redundante de segurança mas reduz tráfego.

### 4.3 Função pura `pickBadgeKind`

`src/app/(authenticated)/palpites/_components/score-badge.tsx`:

```ts
import type { Prediction, PredictionScore } from "@/lib/types/prediction";

export type BadgeKind = "no_prediction" | "awaiting" | "exact" | "winner_or_draw" | "miss";

export function pickBadgeKind(
  score: PredictionScore | null,
  prediction: Prediction | null,
): BadgeKind {
  if (prediction === null) return "no_prediction";
  if (score === null) return "awaiting";
  return score.tier; // 'exact' | 'winner_or_draw' | 'miss'
}
```

Componente `<ScoreBadge>` mapeia o `BadgeKind` para variant + label.

### 4.4 Mudanças no `MatchPredictionCard`

```tsx
// Hoje (resumido):
<Card className={cn(isClosed && "opacity-60")}>
  <form>
    <CardHeader>...</CardHeader>
    <CardContent>{placares}</CardContent>
    {knockoutNeedsAdvance && <CardContent>{advance radios}</CardContent>}
    <CardFooter>{Salvar}</CardFooter>
  </form>
</Card>
```

Vira:

```tsx
<Card>  {/* sem opacity */}
  <form>
    <CardHeader>...</CardHeader>
    <CardContent>{placares — disabled quando isClosed}</CardContent>
    {!isClosed && knockoutNeedsAdvance && <CardContent>{advance radios}</CardContent>}
    {isClosed && (
      <CardContent>
        <ResultRow match={match} />
        <ScoreBadge score={match.score} prediction={match.prediction} />
      </CardContent>
    )}
    {!isClosed && <CardFooter>{Salvar}</CardFooter>}
  </form>
</Card>
```

`<ResultRow>` decide entre:
- `match.status in ('cancelled','postponed')` → "Partida cancelada/adiada"
- `match.home_score === null` → "Aguardando resultado oficial"
- caso contrário → `"Resultado oficial: {home} × {away}"`

### 4.5 Header de `/palpites`

```tsx
const totalPts = filtered.reduce((acc, m) => acc + (m.score?.points ?? 0), 0);
// ...
<Badge>
  {savedCount}/{filtered.length} palpites · {totalPts} pts
</Badge>
```

## 5. Estratégia de testes

`src/app/(authenticated)/palpites/__tests__/score-badge.test.ts`:

| Caso | Esperado |
|---|---|
| `prediction === null` (com ou sem score) | `no_prediction` |
| `prediction != null && score === null` | `awaiting` |
| `score.tier === 'exact'` | `exact` |
| `score.tier === 'winner_or_draw'` | `winner_or_draw` |
| `score.tier === 'miss'` | `miss` |

5 testes. Sem framework de UI; o JSX é validado em E2E manual.

## 6. Riscos e questões em aberto

1. **`MatchWithPrediction` reaproveitado** — campo `score` é opcional (não quebra produtores que só preenchem `prediction`). Plano valida buscando outras chamadas a `getMatchesWithPredictions`.
2. **Variants de `Badge`** (`upcoming`, `secondary`, `outline`) — já em uso em `/palpites` e `/inicio`, OK.
3. **Acessibilidade** — bloco "Resultado oficial" com `aria-label` legível ("Resultado oficial: 2 a 1"). Plano inclui.
4. **Performance** — terceira query (`prediction_scores`) ≤ 104 rows. Trivial.
5. **Idempotência visual** — se o admin alterar resultado, `revalidatePath("/palpites")` (já feito em SP-02 hooks? **conferir**). Se não estiver, plano adiciona.

## 7. Como SP-05+ consomem

- **SP-05** (jogos remarcados) usa o mesmo card; quando admin reabrir kickoff, `isClosed` volta a ser `false` automaticamente porque depende de `Date.now() < kickoff_at`. Sem mudança.
- **SP-07** (premiação) consome `loadRanking()` (SP-03), independente de SP-04.
