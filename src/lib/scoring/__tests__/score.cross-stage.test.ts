import { describe, it, expect } from "vitest";
import { score, POINTS_TABLE } from "@/lib/scoring";
import { STAGES } from "@/lib/types/match";

const m = (h: number, a: number) => ({ home_score: h, away_score: a });

describe("score() — paga conforme tabela em todas as 7 fases", () => {
  for (const stage of STAGES) {
    const expected = POINTS_TABLE[stage];

    it(`${stage}: placar exato → exact`, () => {
      expect(score({ prediction: m(2, 1), match: m(2, 1), stage }))
        .toEqual({ points: expected.exact, tier: "exact" });
    });

    it(`${stage}: vencedor + gols → winner_plus_goals`, () => {
      expect(score({ prediction: m(3, 1), match: m(2, 1), stage }))
        .toEqual({ points: expected.winner_plus_goals, tier: "winner_or_draw" });
    });

    it(`${stage}: só vencedor → winner_or_draw`, () => {
      expect(score({ prediction: m(1, 0), match: m(2, 1), stage }))
        .toEqual({ points: expected.winner_or_draw, tier: "winner_or_draw" });
    });

    it(`${stage}: empate sem exato → winner_or_draw`, () => {
      expect(score({ prediction: m(2, 2), match: m(1, 1), stage }))
        .toEqual({ points: expected.winner_or_draw, tier: "winner_or_draw" });
    });

    it(`${stage}: vencedor invertido → miss`, () => {
      expect(score({ prediction: m(1, 2), match: m(2, 1), stage }))
        .toEqual({ points: 0, tier: "miss" });
    });
  }
});
