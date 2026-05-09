import type { Stage } from "@/lib/types/match";

export type Tier = "exact" | "winner_or_draw" | "miss";

export type ScoreInput = {
  prediction: { home_score: number; away_score: number };
  match:      { home_score: number; away_score: number };
  stage:      Stage;
};

export type ScoreOutput = { points: number; tier: Tier };

export function score(_input: ScoreInput): ScoreOutput {
  throw new Error("not implemented");
}
