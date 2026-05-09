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
