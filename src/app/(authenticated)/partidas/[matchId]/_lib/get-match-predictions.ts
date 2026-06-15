import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadRanking } from "@/lib/scoring/ranking";
import type { Match, Team } from "@/lib/types/match";
import {
  joinPredictionRows,
  type MatchPredictionRow,
  type PredictionLite,
  type ScoreLite,
} from "./join-prediction-rows";

export type MatchWithTeams = Match & {
  home_team: Pick<Team, "id" | "code" | "name" | "flag_url"> | null;
  away_team: Pick<Team, "id" | "code" | "name" | "flag_url"> | null;
};

export type MatchDetailData = {
  match: MatchWithTeams;
  predictions: MatchPredictionRow[];
};

export async function getMatchPredictions(
  matchId: string,
): Promise<MatchDetailData | null> {
  const supabase = await createClient();

  const matchQ = supabase
    .from("matches")
    .select(
      `*, home_team:home_team_id(id,code,name,flag_url), away_team:away_team_id(id,code,name,flag_url)`,
    )
    .eq("id", matchId)
    .maybeSingle();

  const predictionsQ = supabase
    .from("predictions")
    .select("user_id, home_score, away_score")
    .eq("match_id", matchId);

  const scoresQ = supabase
    .from("prediction_scores")
    .select("user_id, points, tier")
    .eq("match_id", matchId);

  const [matchRes, predsRes, scoresRes, ranking] = await Promise.all([
    matchQ,
    predictionsQ,
    scoresQ,
    loadRanking(),
  ]);

  if (matchRes.error) throw matchRes.error;
  if (predsRes.error) throw predsRes.error;
  if (scoresRes.error) throw scoresRes.error;

  if (!matchRes.data) return null;

  return {
    match: matchRes.data as MatchWithTeams,
    predictions: joinPredictionRows({
      ranking,
      predictions: (predsRes.data ?? []) as PredictionLite[],
      scores: (scoresRes.data ?? []) as ScoreLite[],
    }),
  };
}
