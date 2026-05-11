// src/lib/api-football/diff.ts
import type { DiffEntry, MatchPatch } from "./types";

export type DbMatchSlim = {
  id: string;
  api_football_id: number | null;
  home_team_name: string;
  away_team_name: string;
  home_score: number | null;
  away_score: number | null;
  home_score_et: number | null;
  away_score_et: number | null;
  home_pens: number | null;
  away_pens: number | null;
  winner_team_id: string | null;
  status: "postponed" | "cancelled" | null;
};

type Field = DiffEntry["changes"][number]["field"];

const FIELDS: Field[] = [
  "home_score", "away_score",
  "home_score_et", "away_score_et",
  "home_pens", "away_pens",
  "winner_team_id", "status",
];

const SCORE_FIELDS: ReadonlySet<Field> = new Set<Field>([
  "home_score", "away_score", "home_score_et", "away_score_et",
  "home_pens", "away_pens", "winner_team_id",
]);

export function buildDiffEntry(db: DbMatchSlim, patch: MatchPatch): DiffEntry | null {
  const changes: DiffEntry["changes"] = [];
  let willRecompute = false;

  for (const field of FIELDS) {
    const from = (db as Record<string, unknown>)[field];
    const to = (patch as Record<string, unknown>)[field];
    if (from !== to) {
      changes.push({ field, from, to });
      if (SCORE_FIELDS.has(field)) willRecompute = true;
    }
  }

  if (changes.length === 0) return null;
  return {
    matchId: db.id,
    apiFootballId: patch.api_football_id!,
    label: `${db.home_team_name} x ${db.away_team_name}`,
    changes,
    willRecompute,
  };
}
