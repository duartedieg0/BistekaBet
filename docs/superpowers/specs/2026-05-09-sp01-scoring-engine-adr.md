# ADR · SP-01 Scoring Engine

**Data:** 2026-05-09
**Status:** Aceito
**Spec:** `2026-05-09-sp01-scoring-engine-design.md`
**Regulamento:** `docs/regulamento.md`

## Contexto

O regulamento (§5–§9) define a tabela e as regras de pontuação do bolão. A engine
precisa ser fonte única de verdade para todos os consumidores (SP-02, SP-03, SP-04).

## Decisões

| ID | Decisão | Cláusula | Justificativa |
|---|---|---|---|
| D1 | `matches.home_score`/`away_score` representam o placar do tempo normal | §5 | ET e pênaltis ficam em colunas próprias, irrelevantes ao scoring |
| D2 | Engine é TS puro; SP-02 materializa `{ points, tier }` em `prediction_scores` | §6, §11 | Testabilidade contra exemplos do regulamento; SP-03 vira agregação trivial |
| D3 | Tier reduzido: `exact \| winner_or_draw \| miss` | §12.1, §12.2, §12.3 | Suficiente para todos os critérios de desempate; a UI deriva detalhe a partir de `points + match.result` |
| D4 | Palpite ausente não chega à engine; SP-02 grava `{0, 'miss'}` direto | §3 | Mantém engine pura; separa policy de cálculo |
| D5 | Partida sem resultado oficial não é submetida à engine | §11 | Idem D4 |
| D6 | Reuso de `Stage` de `src/lib/types/match.ts` | — | Fonte única do domínio |

## Mapeamento exemplos do regulamento → testes

| Cláusula | Exemplo | Teste |
|---|---|---|
| §7.1 | Brasil 2x1, palpite 1x0 → vencedor | `score.test.ts` |
| §7.2 ex.1 | Brasil 2x1, palpite 3x1 → vencedor + gols | `score.test.ts` |
| §7.2 ex.2 | Brasil 1x0, palpite 2x0 → 0 gols conta | `score.test.ts` |
| §7.3 | 2x1 real, 2x1 palpite → exato | `score.test.ts` |
| §8 ex.1 | 1x1 real, 2x2 palpite → empate | `score.test.ts` |
| §8 ex.2 | 1x1 real, 1x1 palpite → exato | `score.test.ts` |
| §6 (tabela) | 21 células × 7 fases | `points-table.test.ts` + `score.cross-stage.test.ts` |
| §9 | Linha "3º lugar" da tabela | `points-table.test.ts` (`third_place`) |

## Consequências

- Alterações futuras na tabela de pontos exigem update simultâneo em
  `points-table.ts` e `points-table.test.ts` — falha intencional caso alguém
  esqueça um dos dois.
- A regra "não cumulativa" (§6) é garantida pela ordem das verificações em
  `score.ts`: `exact` tem precedência absoluta; demais ramos são exclusivos.
- A redução do tier (D3) impede que SP-03 ofereça desempate por "vencedor + gols".
  Caso o regulamento mude para incluir esse critério, a tabela de tiers e a
  engine precisam ser revisadas.

## Não-objetivos (para SP-01)

- Persistência, recálculo em massa, ranking, desempate, UI, server actions, RLS.
