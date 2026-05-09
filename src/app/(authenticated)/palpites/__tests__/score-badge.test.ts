import { describe, it, expect } from "vitest";
import { pickBadgeKind } from "@/app/(authenticated)/palpites/_components/score-badge";
import type { Prediction, PredictionScore } from "@/lib/types/prediction";

const aPrediction: Prediction = {
  id: "p1",
  user_id: "u1",
  match_id: "m1",
  home_score: 2,
  away_score: 1,
  advances_team_id: null,
  advances_slot: null,
  created_at: "",
  updated_at: "",
};

const aScore = (tier: PredictionScore["tier"], points: number): PredictionScore =>
  ({ tier, points });

describe("pickBadgeKind", () => {
  it("sem palpite → 'no_prediction' (mesmo se score for null)", () => {
    expect(pickBadgeKind(null, null)).toBe("no_prediction");
    expect(pickBadgeKind(aScore("exact", 7), null)).toBe("no_prediction");
  });

  it("palpite mas sem score (resultado pendente) → 'awaiting'", () => {
    expect(pickBadgeKind(null, aPrediction)).toBe("awaiting");
  });

  it("tier 'exact' → 'exact'", () => {
    expect(pickBadgeKind(aScore("exact", 7), aPrediction)).toBe("exact");
  });

  it("tier 'winner_or_draw' → 'winner_or_draw'", () => {
    expect(pickBadgeKind(aScore("winner_or_draw", 4), aPrediction)).toBe(
      "winner_or_draw",
    );
  });

  it("tier 'miss' → 'miss'", () => {
    expect(pickBadgeKind(aScore("miss", 0), aPrediction)).toBe("miss");
  });
});
