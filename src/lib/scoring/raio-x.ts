import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paginateAll } from "@/lib/supabase/paginate";
import { saoPauloDay } from "@/lib/dates/sao-paulo-day";
import { buildRaioXTimeline, type RaioXResult, type RaioXScore } from "./raio-x-core";
import type { ProfileRow } from "./ranking-core";
import type { Tier } from "@/lib/scoring";
import type { Stage } from "@/lib/types/match";

type ScoreJoinRow = {
  user_id: string;
  points: number;
  tier: string;
  matches:
    | { stage: string; kickoff_at: string }
    | { stage: string; kickoff_at: string }[];
};

export async function loadRaioX(userId: string): Promise<RaioXResult> {
  const supabase = await createClient();

  const [profilesQ, scoreRows] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url, paid"),
    paginateAll<ScoreJoinRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("prediction_scores")
        .select("user_id, points, tier, matches!inner(stage, kickoff_at)")
        .order("prediction_id", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as unknown as ScoreJoinRow[];
    }),
  ]);

  if (profilesQ.error) throw profilesQ.error;

  const profiles = (profilesQ.data ?? []) as ProfileRow[];
  const scores: RaioXScore[] = scoreRows.map((r) => {
    const m = Array.isArray(r.matches) ? r.matches[0] : r.matches;
    return {
      user_id: r.user_id,
      points: r.points,
      tier: r.tier as Tier,
      stage: m.stage as Stage,
      day: saoPauloDay(m.kickoff_at),
    };
  });

  return buildRaioXTimeline({ userId, profiles, scores });
}
