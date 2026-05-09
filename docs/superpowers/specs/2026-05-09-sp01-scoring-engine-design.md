# SP-01 · Scoring Engine — Design

**Data:** 2026-05-09
**Plano macro:** [`2026-05-09-plano-macro-regulamento.md`](./2026-05-09-plano-macro-regulamento.md)
**Regulamento:** [`docs/regulamento.md`](../../regulamento.md)
**Cláusulas cobertas:** §5, §6, §7, §8, §9

---

## 1. Objetivo

Entregar um módulo TypeScript puro que, dado um palpite, o resultado oficial do **tempo normal** de uma partida e a fase, retorne `{ points, tier }` aderente integralmente à tabela de pontuação do regulamento (§6) e às regras de classificação §7 (jogos com vencedor) e §8 (jogos empatados).

Este sub-projeto é a **fundação** de SP-02 (materialização), SP-03 (ranking/desempate) e SP-04 (visão do participante).

## 2. Não-objetivos

- Persistir pontos no banco — SP-02.
- Recalcular pontos em massa — SP-02.
- Ranking, desempate, página de classificação — SP-03.
- Tratar palpite ausente em UI ou ranking — SP-04.
- Reabrir palpites de jogos remarcados — SP-05.
- Qualquer mudança de schema, RLS, rota, server action ou UI.

## 3. Decisões de design

| # | Decisão | Justificativa |
|---|---|---|
| D1 | `matches.home_score`/`away_score` representam o **placar do tempo normal**. ET e pênaltis são metadados informativos. | §5 do regulamento; convenção confirmada do projeto. |
| D2 | Engine é **TypeScript puro**, sem I/O. Materialização (SP-02) grava `{ points, tier }`; SP-03 só agrega colunas materializadas. | Testabilidade contra exemplos do regulamento; evita duplicar lógica em SQL; SP-03 fica trivial. |
| D3 | **Tier minimalista**: `'exact' \| 'winner_or_draw' \| 'miss'`. Pontos pagos são corretos para os 5 casos do regulamento; o tier persistido colapsa "vencedor", "vencedor+gols" e "acerto de empate" em `winner_or_draw`. | §12.1/§12.2 só precisam contar `exact`; §12.3 só precisa contar acertos > 0; demais tiers são desnecessários para desempate e UI deriva detalhe a partir de `points + match`. |
| D4 | Palpite ausente **não chega à engine**. A camada chamadora (SP-02) grava `{ points: 0, tier: 'miss' }` direto. | Mantém engine pura; separa policy de cálculo (§3 vs §6/§7/§8). |
| D5 | Partida sem `home_score`/`away_score` definidos **não chega à engine**. SP-02 simplesmente não invoca. | Idem D4: engine = matemática pura. |
| D6 | Reaproveitar `Stage` de `src/lib/types/match.ts`. | Fonte única de verdade para o domínio. |

## 4. Arquitetura

### 4.1 Localização

```
src/lib/scoring/
  index.ts              # API pública: score(), POINTS_TABLE, types
  points-table.ts       # const POINTS_TABLE (espelha §6 literalmente)
  score.ts              # função score()
  __tests__/
    score.test.ts             # exemplos do regulamento (§7, §8)
    score.cross-stage.test.ts # mesma combinação em 7 stages
    points-table.test.ts      # 21 células literais
    classify.invariants.test.ts
```

### 4.2 API pública

```ts
import type { Stage } from "@/lib/types/match";

export type Tier = "exact" | "winner_or_draw" | "miss";

export type ScoreInput = {
  prediction: { home_score: number; away_score: number };
  match:      { home_score: number; away_score: number }; // tempo normal (D1)
  stage:      Stage;
};

export type ScoreOutput = { points: number; tier: Tier };

export function score(input: ScoreInput): ScoreOutput;
export const POINTS_TABLE: Readonly<Record<Stage, {
  winner_or_draw: number;
  winner_plus_goals: number;
  exact: number;
}>>;
```

### 4.3 Tabela de pontos (§6)

```ts
export const POINTS_TABLE = {
  group:        { winner_or_draw: 2,  winner_plus_goals: 4,  exact: 7  },
  round_of_32:  { winner_or_draw: 3,  winner_plus_goals: 6,  exact: 10 },
  round_of_16:  { winner_or_draw: 4,  winner_plus_goals: 8,  exact: 13 },
  quarter:      { winner_or_draw: 6,  winner_plus_goals: 11, exact: 18 },
  semi:         { winner_or_draw: 8,  winner_plus_goals: 15, exact: 25 },
  third_place:  { winner_or_draw: 7,  winner_plus_goals: 13, exact: 22 },
  final:        { winner_or_draw: 11, winner_plus_goals: 20, exact: 34 },
} as const;
```

> O nome `winner_plus_goals` existe **na tabela de pontos** (necessário para pagar §7.2 corretamente), mas o **tier de saída** é sempre `winner_or_draw` quando o palpite cai nesse caso. Decisão D3.

### 4.4 Algoritmo (§7, §8 — não cumulativo §6)

```ts
function score({ prediction, match, stage }: ScoreInput): ScoreOutput {
  const p = POINTS_TABLE[stage];
  const ph = prediction.home_score, pa = prediction.away_score;
  const mh = match.home_score,      ma = match.away_score;

  // §7.3 / §8 ex.2: placar exato (precedência absoluta — não cumulativo)
  if (ph === mh && pa === ma) {
    return { points: p.exact, tier: "exact" };
  }

  const matchIsDraw      = mh === ma;
  const predictionIsDraw = ph === pa;

  // §8: jogo empatou no tempo normal
  if (matchIsDraw) {
    if (predictionIsDraw) {
      return { points: p.winner_or_draw, tier: "winner_or_draw" };
    }
    return { points: 0, tier: "miss" };
  }

  // §7: jogo com vencedor
  const matchHomeWon      = mh > ma;
  const predictionHomeWon = ph > pa;
  const sameWinner = !predictionIsDraw && (matchHomeWon === predictionHomeWon);

  if (!sameWinner) return { points: 0, tier: "miss" };

  // §7.2: vencedor + gols de ao menos um time (0 gols conta — regra explícita)
  if (ph === mh || pa === ma) {
    return { points: p.winner_plus_goals, tier: "winner_or_draw" };
  }

  // §7.1: só o vencedor
  return { points: p.winner_or_draw, tier: "winner_or_draw" };
}
```

### 4.5 Princípios

- Pura: nenhuma dependência de runtime, sem `Date.now()`, sem fetch.
- Determinística: mesma entrada → mesma saída.
- Sem alocação não-trivial; complexidade O(1).

## 5. Estratégia de testes

| Arquivo | Cobre |
|---|---|
| `score.test.ts` | Cada exemplo numerado do regulamento (§7.1, §7.2 ex.1, §7.2 ex.2, §7.3, §8 ex.1, §8 ex.2) com nome do teste referenciando a cláusula. Casos de borda: empate previsto em jogo decidido, vencedor invertido, 0×0 exato, 0×0 vs 1×1. |
| `score.cross-stage.test.ts` | Mesma combinação `(palpite, resultado)` avaliada nas 7 stages — confere cada linha da tabela. |
| `points-table.test.ts` | 21 células assertadas literalmente contra o regulamento; falha se alguém editar a constante sem atualizar o teste. |
| `classify.invariants.test.ts` | Propriedades: `exact ⟹ points = POINTS_TABLE[stage].exact`; `winner_or_draw ⟹ points > 0`; `miss ⟹ points = 0`; pureza (1000 chamadas idênticas). |

**Critério de aceitação:** suíte verde, **100% dos exemplos do regulamento cobertos**, sem skips.

**Runner:** vitest (a confirmar no plano de implementação — verificar `package.json`).

## 6. Entregáveis

1. Diretório `src/lib/scoring/` com módulos descritos em 4.1.
2. Suíte de testes verde.
3. ADR `docs/superpowers/specs/2026-05-09-sp01-scoring-engine-adr.md` mapeando cada decisão da seção 3 à cláusula correspondente do regulamento.
4. **Sem migrations, sem rotas, sem UI, sem server actions.**

## 7. Riscos e questões em aberto

1. **Runner de teste** — projeto ainda não tem suíte de testes configurada. Decidir vitest vs node:test no plano de implementação.
2. **Label de "Oitavas" vs "16-avos"** — `STAGE_LABELS.round_of_16 = "16-avos"` em `src/lib/types/match.ts`, mas o regulamento usa "Oitavas". Não bloqueia SP-01 (label é só UI), mas vale registrar para alinhar antes de SP-04.
3. **Validação de inputs** — engine assume `home_score`/`away_score` inteiros ≥ 0 (já garantido pelo schema). Se quisermos defensividade extra (ex.: `Number.isInteger`), decidir no plano.

## 8. Como SP-02+ consomem

- **SP-02** importa `score` e, ao salvar resultado de uma partida no admin, itera sobre todos os palpites daquela partida, chama `score(...)` e faz upsert em `prediction_scores`. Para usuários sem palpite, grava `{ points: 0, tier: 'miss' }` direto (D4).
- **SP-03** lê `prediction_scores` agregando `SUM(points)`, `COUNT(*) FILTER (WHERE tier = 'exact')` etc. — sem invocar a engine.
- **SP-04** mostra o `points` materializado por palpite; descrição textual ("acertou o vencedor", "placar exato") é derivada localmente a partir de `tier + points + match.result`.
