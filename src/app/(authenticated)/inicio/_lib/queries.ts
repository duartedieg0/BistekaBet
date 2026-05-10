import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MatchWithPrediction,
  PredictionScore,
} from "@/lib/types/prediction";
import type { Tier } from "@/lib/scoring";
import { saoPauloDayRange } from "@/lib/dates/sao-paulo-day";

const MATCH_SELECT = `
  *,
  home_team:home_team_id(id,code,name,flag_url),
  away_team:away_team_id(id,code,name,flag_url),
  prediction:predictions!left(
    id,user_id,match_id,home_score,away_score,advances_team_id,advances_slot,created_at,updated_at
  )
`;

async function fetchMatchesInRange(
  supabase: SupabaseClient,
  userId: string,
  startUtc: Date,
  endUtc: Date,
): Promise<MatchWithPrediction[]> {
  const matchesP = supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("predictions.user_id", userId)
    .gte("kickoff_at", startUtc.toISOString())
    .lt("kickoff_at", endUtc.toISOString())
    .order("kickoff_at", { ascending: true });

  const scoresP = supabase
    .from("prediction_scores")
    .select("prediction_id, points, tier")
    .eq("user_id", userId);

  const [matchesRes, scoresRes] = await Promise.all([matchesP, scoresP]);
  if (matchesRes.error) throw matchesRes.error;
  if (scoresRes.error) throw scoresRes.error;

  const scoreByPredId = new Map<string, PredictionScore>();
  const scoreRows = (scoresRes.data ?? []) as {
    prediction_id: string;
    points: number;
    tier: Tier;
  }[];
  for (const r of scoreRows) {
    scoreByPredId.set(r.prediction_id, { points: r.points, tier: r.tier });
  }

  return (matchesRes.data ?? []).map((row: { prediction: unknown[] | null }) => {
    const predictionArr = row.prediction;
    const prediction =
      Array.isArray(predictionArr) && predictionArr.length > 0
        ? (predictionArr[0] as MatchWithPrediction["prediction"])
        : null;
    const score = prediction ? (scoreByPredId.get(prediction.id) ?? null) : null;
    return { ...(row as object), prediction, score };
  }) as MatchWithPrediction[];
}

export type DayMatchesResult = {
  matches: MatchWithPrediction[];
  referenceDate: Date | null;
  isToday: boolean;
};

export async function getInicioDayMatches(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<DayMatchesResult> {
  const today = saoPauloDayRange(now);
  const todayMatches = await fetchMatchesInRange(
    supabase,
    userId,
    today.startUtc,
    today.endUtc,
  );

  if (todayMatches.length > 0) {
    return { matches: todayMatches, referenceDate: now, isToday: true };
  }

  const { data: nextRow, error: nextErr } = await supabase
    .from("matches")
    .select("kickoff_at")
    .gte("kickoff_at", today.endUtc.toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (nextErr) throw nextErr;
  if (!nextRow) return { matches: [], referenceDate: null, isToday: false };

  const nextRef = new Date(nextRow.kickoff_at as string);
  const next = saoPauloDayRange(nextRef);
  const nextMatches = await fetchMatchesInRange(
    supabase,
    userId,
    next.startUtc,
    next.endUtc,
  );
  return { matches: nextMatches, referenceDate: nextRef, isToday: false };
}
