import type { z } from "zod";
import type {
  FixtureSchema, TeamSchema, ApiFootballStatusShort,
} from "./schemas";

export type ApiFootballFixture = z.infer<typeof FixtureSchema>;
export type ApiFootballTeam = z.infer<typeof TeamSchema>;
export type ApiFootballStatus = z.infer<typeof ApiFootballStatusShort>;

// Patch aplicável em matches (campos opcionais — só os que mudam vão preenchidos no diff)
export type MatchPatch = {
  api_football_id?: number;          // sempre presente quando vem do mapper
  home_score: number | null;
  away_score: number | null;
  home_score_et: number | null;
  away_score_et: number | null;
  home_pens: number | null;
  away_pens: number | null;
  winner_team_id: string | null;
  status: "postponed" | "cancelled" | null;
};

export type DiffEntry = {
  matchId: string;
  apiFootballId: number;
  label: string;
  changes: Array<{
    field:
      | "home_score" | "away_score"
      | "home_score_et" | "away_score_et"
      | "home_pens" | "away_pens"
      | "winner_team_id" | "status";
    from: unknown;
    to: unknown;
  }>;
  willRecompute: boolean;
};
