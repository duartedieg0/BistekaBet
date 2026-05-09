import type { Stage } from "@/lib/types/match";
import { POINTS_TABLE } from "./points-table";

export type Tier = "exact" | "winner_or_draw" | "miss";

export type ScoreInput = {
  prediction: { home_score: number; away_score: number };
  match:      { home_score: number; away_score: number };
  stage:      Stage;
};

export type ScoreOutput = { points: number; tier: Tier };

export function score({ prediction, match, stage }: ScoreInput): ScoreOutput {
  const p = POINTS_TABLE[stage];
  const ph = prediction.home_score;
  const pa = prediction.away_score;
  const mh = match.home_score;
  const ma = match.away_score;

  // §7.3 / §8 ex.2: placar exato (precedência absoluta — não cumulativo §6)
  if (ph === mh && pa === ma) {
    return { points: p.exact, tier: "exact" };
  }

  const matchIsDraw = mh === ma;
  const predictionIsDraw = ph === pa;

  // §8: jogo empatou no tempo normal
  if (matchIsDraw) {
    if (predictionIsDraw) {
      return { points: p.winner_or_draw, tier: "winner_or_draw" };
    }
    return { points: 0, tier: "miss" };
  }

  // §7: jogo com vencedor
  const matchHomeWon = mh > ma;
  const predictionHomeWon = ph > pa;
  const sameWinner = !predictionIsDraw && matchHomeWon === predictionHomeWon;

  if (!sameWinner) return { points: 0, tier: "miss" };

  // §7.2: vencedor + gols de pelo menos um time (0 gols conta)
  if (ph === mh || pa === ma) {
    return { points: p.winner_plus_goals, tier: "winner_or_draw" };
  }

  // §7.1: só o vencedor
  return { points: p.winner_or_draw, tier: "winner_or_draw" };
}
