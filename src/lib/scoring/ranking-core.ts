import type { Stage } from "@/lib/types/match";
import type { Tier } from "@/lib/scoring";

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  paid: boolean;
};

export type ScoreWithStageRow = {
  user_id: string;
  points: number;
  tier: Tier;
  stage: Stage;
};

export type RankingEntry = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  paid: boolean;
  total_points: number;
  exacts_total: number;
  exacts_knockout: number;
  winner_or_draw_total: number;
  final_points: number;
  semi_third_final_points: number;
};

export type RankingRow = RankingEntry & { rank: number };

const KNOCKOUT_STAGES: ReadonlySet<Stage> = new Set<Stage>([
  "round_of_32", "round_of_16", "quarter", "semi", "third_place", "final",
]);

const SEMI_THIRD_FINAL: ReadonlySet<Stage> = new Set<Stage>([
  "semi", "third_place", "final",
]);

export function compareForRanking(a: RankingEntry, b: RankingEntry): number {
  if (a.total_points !== b.total_points) return b.total_points - a.total_points;
  if (a.exacts_total !== b.exacts_total) return b.exacts_total - a.exacts_total;
  if (a.exacts_knockout !== b.exacts_knockout) return b.exacts_knockout - a.exacts_knockout;
  if (a.winner_or_draw_total !== b.winner_or_draw_total)
    return b.winner_or_draw_total - a.winner_or_draw_total;
  if (a.final_points !== b.final_points) return b.final_points - a.final_points;
  if (a.semi_third_final_points !== b.semi_third_final_points)
    return b.semi_third_final_points - a.semi_third_final_points;
  return 0;
}

export function assignRanks(sorted: RankingEntry[]): RankingRow[] {
  const result: RankingRow[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const prev = result[i - 1];
    const tied = prev !== undefined && compareForRanking(sorted[i], sorted[i - 1]) === 0;
    result.push({ ...sorted[i], rank: tied ? prev.rank : i + 1 });
  }
  return result;
}

export function applyScoreToEntry(
  entry: RankingEntry,
  input: { points: number; tier: Tier; stage: Stage },
): void {
  const { points, tier, stage } = input;
  entry.total_points += points;
  if (tier === "exact") {
    entry.exacts_total += 1;
    if (KNOCKOUT_STAGES.has(stage)) entry.exacts_knockout += 1;
  }
  if (tier !== "miss") entry.winner_or_draw_total += 1;
  if (stage === "final") entry.final_points += points;
  if (SEMI_THIRD_FINAL.has(stage)) entry.semi_third_final_points += points;
}

export function aggregate(
  profiles: ProfileRow[],
  scores: ScoreWithStageRow[],
): RankingRow[] {
  const init = new Map<string, RankingEntry>();
  for (const p of profiles) {
    init.set(p.id, {
      user_id: p.id,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      paid: p.paid,
      total_points: 0,
      exacts_total: 0,
      exacts_knockout: 0,
      winner_or_draw_total: 0,
      final_points: 0,
      semi_third_final_points: 0,
    });
  }

  for (const sc of scores) {
    const entry = init.get(sc.user_id);
    if (!entry) continue;
    applyScoreToEntry(entry, { points: sc.points, tier: sc.tier, stage: sc.stage });
  }

  const sorted = [...init.values()].sort(compareForRanking);
  return assignRanks(sorted);
}
