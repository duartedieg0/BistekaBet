import type { RankingRow } from "@/lib/scoring/ranking-core";
import type { PredictionScore } from "@/lib/types/prediction";
import type { Tier } from "@/lib/scoring";

export type PredictionLite = {
  user_id: string;
  home_score: number;
  away_score: number;
};

export type ScoreLite = {
  user_id: string;
  points: number;
  tier: Tier;
};

export type MatchPredictionRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  rank: number;
  prediction: { home_score: number; away_score: number } | null;
  score: PredictionScore | null;
  entry: RankingRow;
};

export function joinPredictionRows(input: {
  ranking: RankingRow[];
  predictions: PredictionLite[];
  scores: ScoreLite[];
}): MatchPredictionRow[] {
  const predByUser = new Map<string, PredictionLite>();
  for (const p of input.predictions) predByUser.set(p.user_id, p);

  const scoreByUser = new Map<string, PredictionScore>();
  for (const s of input.scores) {
    scoreByUser.set(s.user_id, { points: s.points, tier: s.tier });
  }

  return input.ranking.map((r) => {
    const pred = predByUser.get(r.user_id);
    return {
      user_id: r.user_id,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      rank: r.rank,
      prediction: pred ? { home_score: pred.home_score, away_score: pred.away_score } : null,
      score: scoreByUser.get(r.user_id) ?? null,
      entry: r,
    };
  });
}
