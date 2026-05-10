import type { Stage } from "@/lib/types/match";
import { POINTS_TABLE } from "@/lib/scoring/points-table";

export function computePointsPossible(matches: { stage: Stage }[]): number {
  let total = 0;
  for (const m of matches) {
    total += POINTS_TABLE[m.stage].exact;
  }
  return total;
}
