import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadRanking } from "@/lib/scoring/ranking";

export type SuaPosicaoData = {
  rank: number;
  totalPlayers: number;
  totalPoints: number;
  exactCount: number;
};

export async function loadSuaPosicaoData(userId: string): Promise<SuaPosicaoData> {
  const supabase = await createClient();

  const [ranking, exactRes] = await Promise.all([
    loadRanking(),
    supabase
      .from("prediction_scores")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("tier", "exact"),
  ]);

  if (exactRes.error) throw exactRes.error;

  const row = ranking.find((r) => r.user_id === userId);
  const rank = row?.rank ?? ranking.length + 1;
  const totalPoints = row?.total_points ?? 0;
  const totalPlayers = ranking.length;
  const exactCount = exactRes.count ?? 0;

  return { rank, totalPlayers, totalPoints, exactCount };
}
