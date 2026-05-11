// src/lib/api-football/mapper.ts
import type { ApiFootballFixture, MatchPatch } from "./types";

const FINISHED = new Set(["FT", "AET", "PEN"] as const);

export function mapFixtureToPatch(
  fixture: ApiFootballFixture,
  homeMatchTeamId: string,
  awayMatchTeamId: string,
): MatchPatch {
  const { score, goals, fixture: fx } = fixture;
  const short = fx.status.short;

  // Status mapping (spec §3.1)
  let status: MatchPatch["status"] = null;
  if (short === "PST") status = "postponed";
  else if (short === "CANC") status = "cancelled";

  const isFinished = FINISHED.has(short as "FT" | "AET" | "PEN");

  // Pull scores only if finished; PST/CANC keep null
  const home_score      = isFinished ? goals.home : null;
  const away_score      = isFinished ? goals.away : null;
  const home_score_et   = isFinished && short !== "FT" ? score.extratime.home : null;
  const away_score_et   = isFinished && short !== "FT" ? score.extratime.away : null;
  const home_pens       = short === "PEN" ? score.penalty.home : null;
  const away_pens       = short === "PEN" ? score.penalty.away : null;

  // Winner derivation
  let winner_team_id: string | null = null;
  if (isFinished && home_score !== null && away_score !== null) {
    if (short === "PEN" && home_pens !== null && away_pens !== null) {
      winner_team_id = home_pens > away_pens ? homeMatchTeamId : awayMatchTeamId;
    } else {
      const h = home_score + (home_score_et ?? 0);
      const a = away_score + (away_score_et ?? 0);
      if (h > a) winner_team_id = homeMatchTeamId;
      else if (a > h) winner_team_id = awayMatchTeamId;
      else winner_team_id = null; // empate em fase de grupos
    }
  }

  return {
    api_football_id: fx.id,
    home_score, away_score,
    home_score_et, away_score_et,
    home_pens, away_pens,
    winner_team_id,
    status,
  };
}
