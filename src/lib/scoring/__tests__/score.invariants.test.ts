import { describe, it, expect } from "vitest";
import { score, POINTS_TABLE, type ScoreInput } from "@/lib/scoring";
import { STAGES } from "@/lib/types/match";

const m = (h: number, a: number) => ({ home_score: h, away_score: a });

const SAMPLES: ScoreInput[] = [
  { prediction: m(2, 1), match: m(2, 1), stage: "group" },
  { prediction: m(3, 1), match: m(2, 1), stage: "final" },
  { prediction: m(1, 0), match: m(2, 1), stage: "semi" },
  { prediction: m(2, 2), match: m(1, 1), stage: "quarter" },
  { prediction: m(1, 2), match: m(2, 1), stage: "round_of_16" },
  { prediction: m(0, 0), match: m(0, 0), stage: "third_place" },
];

describe("score() — invariantes", () => {
  it("tier 'exact' implica points = POINTS_TABLE[stage].exact", () => {
    for (const s of SAMPLES) {
      const r = score(s);
      if (r.tier === "exact") {
        expect(r.points).toBe(POINTS_TABLE[s.stage].exact);
      }
    }
  });

  it("tier 'winner_or_draw' implica points > 0", () => {
    for (const s of SAMPLES) {
      const r = score(s);
      if (r.tier === "winner_or_draw") {
        expect(r.points).toBeGreaterThan(0);
      }
    }
  });

  it("tier 'miss' implica points = 0", () => {
    for (const s of SAMPLES) {
      const r = score(s);
      if (r.tier === "miss") {
        expect(r.points).toBe(0);
      }
    }
  });

  it("é determinística: mesma entrada → mesma saída (1000 chamadas)", () => {
    for (const stage of STAGES) {
      const input: ScoreInput = { prediction: m(2, 1), match: m(2, 1), stage };
      const first = score(input);
      for (let i = 0; i < 1000; i++) {
        expect(score(input)).toEqual(first);
      }
    }
  });

  it("nunca retorna points negativos ou NaN", () => {
    for (const s of SAMPLES) {
      const r = score(s);
      expect(Number.isFinite(r.points)).toBe(true);
      expect(r.points).toBeGreaterThanOrEqual(0);
    }
  });
});
