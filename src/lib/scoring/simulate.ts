import type { Stage } from "@/lib/types/match";
import { score, type Tier } from "@/lib/scoring";
import {
  applyScoreToEntry,
  assignRanks,
  compareForRanking,
  type RankingEntry,
  type RankingRow,
} from "./ranking-core";

export type SimulatedRow = {
  points: number | null; // pontos desta partida (null = não palpitou)
  tier: Tier | null;
  total: number; // total no bolão já com a simulação
  rank: number; // rank simulado
  delta: number; // rankAtual - rankSimulado (positivo = subiu)
};

export function simulateMatchRanking(input: {
  entries: RankingRow[];
  predictions: Map<string, { home: number; away: number }>;
  result: { home: number; away: number };
  stage: Stage;
}): Map<string, SimulatedRow> {
  const { entries, predictions, result, stage } = input;

  const currentRank = new Map<string, number>();
  const perMatch = new Map<string, { points: number | null; tier: Tier | null }>();

  const clones: RankingEntry[] = entries.map((e) => {
    currentRank.set(e.user_id, e.rank);
    // Clona o entry. O campo extra `rank` é inofensivo: applyScoreToEntry e
    // compareForRanking o ignoram, e assignRanks o sobrescreve.
    const clone: RankingEntry = { ...e };

    const pred = predictions.get(e.user_id);
    if (pred) {
      const { points, tier } = score({
        prediction: { home_score: pred.home, away_score: pred.away },
        match: { home_score: result.home, away_score: result.away },
        stage,
      });
      applyScoreToEntry(clone, { points, tier, stage });
      perMatch.set(e.user_id, { points, tier });
    } else {
      perMatch.set(e.user_id, { points: null, tier: null });
    }
    return clone;
  });

  const ranked = assignRanks([...clones].sort(compareForRanking));

  const out = new Map<string, SimulatedRow>();
  for (const r of ranked) {
    const pm = perMatch.get(r.user_id)!;
    const prev = currentRank.get(r.user_id)!;
    out.set(r.user_id, {
      points: pm.points,
      tier: pm.tier,
      total: r.total_points,
      rank: r.rank,
      delta: prev - r.rank,
    });
  }
  return out;
}
