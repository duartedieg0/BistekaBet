import { score, type Tier } from "@/lib/scoring";
import type { Stage } from "@/lib/types/match";

export type MatchSnapshot = {
  id: string;
  stage: Stage;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
};

export type PredictionSnapshot = {
  id: string;
  user_id: string;
  home_score: number;
  away_score: number;
};

export type ScoreRow = {
  prediction_id: string;
  match_id: string;
  user_id: string;
  points: number;
  tier: Tier;
};

export type ComputeResult =
  | { kind: "delete" }
  | { kind: "upsert"; rows: ScoreRow[] };

export function computeScoreRows(
  match: MatchSnapshot,
  predictions: PredictionSnapshot[],
): ComputeResult {
  const noResult =
    match.home_score === null ||
    match.away_score === null ||
    match.status === "cancelled" ||
    match.status === "postponed";

  if (noResult) return { kind: "delete" };

  const rows: ScoreRow[] = predictions.map((p) => {
    const r = score({
      prediction: { home_score: p.home_score, away_score: p.away_score },
      match:      { home_score: match.home_score!, away_score: match.away_score! },
      stage:      match.stage,
    });
    return {
      prediction_id: p.id,
      match_id: match.id,
      user_id: p.user_id,
      points: r.points,
      tier: r.tier,
    };
  });

  return { kind: "upsert", rows };
}
