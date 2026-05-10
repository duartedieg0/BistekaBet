import { describe, it, expect } from "vitest";
import { computePointsPossible } from "@/app/(authenticated)/inicio/_lib/avisos-queries";
import { POINTS_TABLE } from "@/lib/scoring/points-table";

describe("computePointsPossible", () => {
  it("soma POINTS_TABLE[stage].exact por match finalizado", () => {
    const matches = [
      { stage: "group" as const },
      { stage: "group" as const },
      { stage: "group" as const },
      { stage: "final" as const },
    ];
    expect(computePointsPossible(matches)).toBe(
      3 * POINTS_TABLE.group.exact + 1 * POINTS_TABLE.final.exact,
    );
  });

  it("lista vazia → 0", () => {
    expect(computePointsPossible([])).toBe(0);
  });

  it("mistura várias fases", () => {
    const matches = [
      { stage: "round_of_16" as const },
      { stage: "quarter" as const },
      { stage: "semi" as const },
    ];
    expect(computePointsPossible(matches)).toBe(
      POINTS_TABLE.round_of_16.exact +
        POINTS_TABLE.quarter.exact +
        POINTS_TABLE.semi.exact,
    );
  });
});
