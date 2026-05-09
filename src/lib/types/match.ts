export const STAGES = [
  "group",
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "third_place",
  "final",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  group: "Fase de Grupos",
  round_of_32: "32-avos",
  round_of_16: "16-avos",
  quarter: "Quartas de Final",
  semi: "Semifinais",
  third_place: "Disputa de 3º Lugar",
  final: "Final",
};

export const GROUP_CODES = ["A","B","C","D","E","F","G","H","I","J","K","L"] as const;
export type GroupCode = (typeof GROUP_CODES)[number];

export type ExplicitMatchStatus = "postponed" | "cancelled";
export type DerivedMatchStatus = "scheduled" | "live" | "finished";
export type MatchStatus = ExplicitMatchStatus | DerivedMatchStatus;

export interface Team {
  id: string;
  code: string;
  name: string;
  flag_url: string | null;
  group_code: GroupCode | null;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  stage: Stage;
  group_code: GroupCode | null;
  bracket_position: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  kickoff_at: string;
  original_kickoff_at: string | null;
  venue: string | null;
  status: ExplicitMatchStatus | null;
  home_score: number | null;
  away_score: number | null;
  home_score_et: number | null;
  away_score_et: number | null;
  home_pens: number | null;
  away_pens: number | null;
  winner_team_id: string | null;
  created_at: string;
  updated_at: string;
}
