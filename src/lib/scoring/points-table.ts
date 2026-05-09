import type { Stage } from "@/lib/types/match";

export const POINTS_TABLE: Readonly<Record<Stage, {
  winner_or_draw: number;
  winner_plus_goals: number;
  exact: number;
}>> = {
  group:        { winner_or_draw: 2,  winner_plus_goals: 4,  exact: 7  },
  round_of_32:  { winner_or_draw: 3,  winner_plus_goals: 6,  exact: 10 },
  round_of_16:  { winner_or_draw: 4,  winner_plus_goals: 8,  exact: 13 },
  quarter:      { winner_or_draw: 6,  winner_plus_goals: 11, exact: 18 },
  semi:         { winner_or_draw: 8,  winner_plus_goals: 15, exact: 25 },
  third_place:  { winner_or_draw: 7,  winner_plus_goals: 13, exact: 22 },
  final:        { winner_or_draw: 11, winner_plus_goals: 20, exact: 34 },
} as const;
