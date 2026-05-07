import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchWithPrediction } from "@/lib/types/prediction";

export async function getMatchesWithPredictions(
  supabase: SupabaseClient,
  userId: string,
): Promise<MatchWithPrediction[]> {
  const { data, error } = await supabase
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

  if (error) throw error;

  return (data ?? []).map((row: { prediction: unknown[] | null }) => ({
    ...(row as object),
    prediction: Array.isArray(row.prediction) && row.prediction.length > 0 ? row.prediction[0] : null,
  })) as MatchWithPrediction[];
}
