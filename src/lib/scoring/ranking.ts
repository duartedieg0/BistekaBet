import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paginateAll } from "@/lib/supabase/paginate";
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

async function loadRankingWith(supabase: SupabaseClient): Promise<RankingRow[]> {
  const [profilesQ, scoreRows] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url, paid"),
    paginateAll<ScoreJoinRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("prediction_scores")
        .select("user_id, points, tier, matches!inner(stage)")
        .order("prediction_id", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as unknown as ScoreJoinRow[];
    }),
  ]);

  if (profilesQ.error) throw profilesQ.error;

  const profiles = (profilesQ.data ?? []) as ProfileRow[];
  const scores: ScoreWithStageRow[] = scoreRows.map((r) => {
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

export async function loadRanking(): Promise<RankingRow[]> {
  return loadRankingWith((await createClient()) as unknown as SupabaseClient);
}

/**
 * Ranking para a home pública (visitante anônimo). Usa service-role porque o RLS
 * de `profiles`/`prediction_scores` é só `authenticated`. Expõe apenas dados já
 * públicos do ranking (nome, avatar, pontos).
 */
export async function loadPublicRanking(): Promise<RankingRow[]> {
  return loadRankingWith(createAdminClient() as unknown as SupabaseClient);
}
