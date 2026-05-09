import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeScoreRows, type MatchSnapshot, type PredictionSnapshot } from "./recompute-core";

export async function recomputeMatchScores(matchId: string): Promise<{
  upserted: number;
  deleted: number;
}> {
  const started = Date.now();
  const admin = createAdminClient();

  const { data: matchRaw, error: mErr } = await admin
    .from("matches")
    .select("id, stage, home_score, away_score, status")
    .eq("id", matchId)
    .single();
  if (mErr) throw mErr;
  const match = matchRaw as MatchSnapshot;

  const { data: predictionsRaw, error: pErr } = await admin
    .from("predictions")
    .select("id, user_id, home_score, away_score")
    .eq("match_id", matchId);
  if (pErr) throw pErr;
  const predictions = (predictionsRaw ?? []) as PredictionSnapshot[];

  const result = computeScoreRows(match, predictions);

  if (result.kind === "delete") {
    const { count, error } = await admin
      .from("prediction_scores")
      .delete({ count: "exact" })
      .eq("match_id", matchId);
    if (error) throw error;
    const out = { upserted: 0, deleted: count ?? 0 };
    console.log("[scoring] recomputeMatchScores", { matchId, ...out, durationMs: Date.now() - started });
    return out;
  }

  if (result.rows.length === 0) {
    const out = { upserted: 0, deleted: 0 };
    console.log("[scoring] recomputeMatchScores", { matchId, ...out, durationMs: Date.now() - started });
    return out;
  }

  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from("prediction_scores")
    .upsert(
      result.rows.map((r) => ({ ...r, scored_at: now })),
      { onConflict: "prediction_id" },
    );
  if (upErr) throw upErr;

  const out = { upserted: result.rows.length, deleted: 0 };
  console.log("[scoring] recomputeMatchScores", { matchId, ...out, durationMs: Date.now() - started });
  return out;
}
