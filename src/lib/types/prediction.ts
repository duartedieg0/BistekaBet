import type { Match, Team } from "@/lib/types/match";

export interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  advances_team_id: string | null;
  advances_slot: "home" | "away" | null;
  created_at: string;
  updated_at: string;
}

export interface MatchWithPrediction extends Match {
  home_team: Pick<Team, "id" | "code" | "name" | "flag_url"> | null;
  away_team: Pick<Team, "id" | "code" | "name" | "flag_url"> | null;
  prediction: Prediction | null;
}
