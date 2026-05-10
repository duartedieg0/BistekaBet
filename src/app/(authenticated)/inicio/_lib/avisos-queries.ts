import type { SupabaseClient } from "@supabase/supabase-js";
import type { Stage } from "@/lib/types/match";
import { POINTS_TABLE } from "@/lib/scoring/points-table";
import { getInicioDayMatches } from "./queries";

export function computePointsPossible(matches: { stage: Stage }[]): number {
  let total = 0;
  for (const m of matches) {
    total += POINTS_TABLE[m.stage].exact;
  }
  return total;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export type AvisosData = {
  paid: boolean;
  nextUnpredictedMatch: {
    id: string;
    homeCode: string;
    awayCode: string;
    kickoffAt: string;
  } | null;
  pendingPredictionsCount: number;
  awaitingResultsCount: number;
  pointsEarned: number;
  pointsPossible: number;
};

type NextMatchRow = {
  id: string;
  kickoff_at: string;
  home_team: { code: string } | null;
  away_team: { code: string } | null;
  predictions: { id: string }[] | null;
};

type FinalizedMatchRow = {
  stage: Stage;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
};

// "Finalizado" segundo o spec: placar oficial preenchido E status NÃO é postponed/cancelled.
// Outros valores possíveis (null, "rescheduled") contam como finalizados.
function isFinalized(row: { home_score: number | null; away_score: number | null; status: string | null }): boolean {
  if (row.home_score === null || row.away_score === null) return false;
  if (row.status === "postponed" || row.status === "cancelled") return false;
  return true;
}

export async function loadAvisosData(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<AvisosData> {
  const nowIso = now.toISOString();
  const upperIso = new Date(now.getTime() + TWENTY_FOUR_HOURS_MS).toISOString();

  const paidP = supabase
    .from("profiles")
    .select("paid")
    .eq("id", userId)
    .maybeSingle();

  const nextUnpredictedP = supabase
    .from("matches")
    .select(
      `id, kickoff_at,
       home_team:home_team_id(code),
       away_team:away_team_id(code),
       predictions!left(id)`,
    )
    .eq("predictions.user_id", userId)
    .gt("kickoff_at", nowIso)
    .lte("kickoff_at", upperIso)
    .order("kickoff_at", { ascending: true })
    .limit(10);

  const dayMatchesP = getInicioDayMatches(supabase, userId, now);

  const awaitingP = supabase
    .from("predictions")
    .select(
      "id, prediction_scores!left(prediction_id), matches!inner(kickoff_at)",
    )
    .eq("user_id", userId)
    .lte("matches.kickoff_at", nowIso);

  const earnedP = supabase
    .from("prediction_scores")
    .select("points")
    .eq("user_id", userId);

  const finalizedP = supabase
    .from("matches")
    .select("stage, status, home_score, away_score");

  const [paidR, nextR, dayR, awaitingR, earnedR, finalizedR] = await Promise.all([
    paidP, nextUnpredictedP, dayMatchesP, awaitingP, earnedP, finalizedP,
  ]);

  if (paidR.error) { console.error("[avisos] paid", paidR.error); throw new Error(`paid: ${JSON.stringify(paidR.error)}`); }
  if (nextR.error) { console.error("[avisos] nextUnpredicted", nextR.error); throw new Error(`nextUnpredicted: ${JSON.stringify(nextR.error)}`); }
  if (awaitingR.error) { console.error("[avisos] awaiting", awaitingR.error); throw new Error(`awaiting: ${JSON.stringify(awaitingR.error)}`); }
  if (earnedR.error) { console.error("[avisos] earned", earnedR.error); throw new Error(`earned: ${JSON.stringify(earnedR.error)}`); }
  if (finalizedR.error) { console.error("[avisos] finalized", finalizedR.error); throw new Error(`finalized: ${JSON.stringify(finalizedR.error)}`); }

  const paid = paidR.data?.paid ?? false;

  const nextRows = (nextR.data ?? []) as unknown as NextMatchRow[];
  const firstUnpredicted = nextRows.find(
    (r) => !r.predictions || r.predictions.length === 0,
  );
  const nextUnpredictedMatch = firstUnpredicted
    ? {
        id: firstUnpredicted.id,
        homeCode: firstUnpredicted.home_team?.code ?? "TBD",
        awayCode: firstUnpredicted.away_team?.code ?? "TBD",
        kickoffAt: firstUnpredicted.kickoff_at,
      }
    : null;

  const pendingPredictionsCount = dayR.matches.filter(
    (m) => m.prediction === null,
  ).length;

  const awaitingRows = (awaitingR.data ?? []) as unknown as {
    id: string;
    prediction_scores: { prediction_id: string }[] | null;
  }[];
  const awaitingResultsCount = awaitingRows.filter(
    (r) => !r.prediction_scores || r.prediction_scores.length === 0,
  ).length;

  const earnedRows = (earnedR.data ?? []) as { points: number }[];
  const pointsEarned = earnedRows.reduce((acc, r) => acc + (r.points ?? 0), 0);

  const finalizedRows = ((finalizedR.data ?? []) as FinalizedMatchRow[]).filter(isFinalized);
  const pointsPossible = computePointsPossible(finalizedRows.map((r) => ({ stage: r.stage })));

  return {
    paid,
    nextUnpredictedMatch,
    pendingPredictionsCount,
    awaitingResultsCount,
    pointsEarned,
    pointsPossible,
  };
}
