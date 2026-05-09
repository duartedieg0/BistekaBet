import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  aggregate,
  type ProfileRow,
  type ScoreWithStageRow,
  type RankingRow,
} from "./ranking-core";

type ScoreJoinRow = {
  user_id: string;
  points: number;
  tier: string;
  matches: { stage: string } | { stage: string }[];
};

export async function loadRanking(): Promise<RankingRow[]> {
  const supabase = await createClient();

  const [profilesQ, scoresQ] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url, paid"),
    supabase
      .from("prediction_scores")
      .select("user_id, points, tier, matches!inner(stage)"),
  ]);

  if (profilesQ.error) throw profilesQ.error;
  if (scoresQ.error) throw scoresQ.error;

  const profiles = (profilesQ.data ?? []) as ProfileRow[];
  const scores: ScoreWithStageRow[] = ((scoresQ.data ?? []) as unknown as ScoreJoinRow[]).map((r) => {
    const m = Array.isArray(r.matches) ? r.matches[0] : r.matches;
    return {
      user_id: r.user_id,
      points: r.points,
      tier: r.tier as ScoreWithStageRow["tier"],
      stage: m.stage as ScoreWithStageRow["stage"],
    };
  });

  return aggregate(profiles, scores);
}
