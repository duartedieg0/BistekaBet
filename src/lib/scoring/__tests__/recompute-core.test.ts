import { describe, it, expect } from "vitest";
import {
  computeScoreRows,
  type MatchSnapshot,
  type PredictionSnapshot,
} from "@/lib/scoring/recompute-core";

const baseMatch: MatchSnapshot = {
  id: "match-1",
  stage: "group",
  home_score: 2,
  away_score: 1,
  status: null,
};

const preds = (xs: Array<{ id: string; user_id: string; h: number; a: number }>): PredictionSnapshot[] =>
  xs.map((x) => ({ id: x.id, user_id: x.user_id, home_score: x.h, away_score: x.a }));

describe("computeScoreRows", () => {
  it("resultado válido + N palpites → upsert com pontos certos", () => {
    const r = computeScoreRows(baseMatch, preds([
      { id: "p1", user_id: "u1", h: 2, a: 1 },
      { id: "p2", user_id: "u2", h: 1, a: 0 },
      { id: "p3", user_id: "u3", h: 1, a: 2 },
    ]));
    expect(r.kind).toBe("upsert");
    if (r.kind !== "upsert") throw new Error();
    expect(r.rows).toEqual([
      { prediction_id: "p1", match_id: "match-1", user_id: "u1", points: 7, tier: "exact" },
      { prediction_id: "p2", match_id: "match-1", user_id: "u2", points: 2, tier: "winner_or_draw" },
      { prediction_id: "p3", match_id: "match-1", user_id: "u3", points: 0, tier: "miss" },
    ]);
  });

  it("home_score null → kind: 'delete'", () => {
    expect(computeScoreRows({ ...baseMatch, home_score: null }, preds([
      { id: "p1", user_id: "u1", h: 0, a: 0 },
    ]))).toEqual({ kind: "delete" });
  });

  it("away_score null → kind: 'delete'", () => {
    expect(computeScoreRows({ ...baseMatch, away_score: null }, [])).toEqual({ kind: "delete" });
  });

  it("status='cancelled' → kind: 'delete' mesmo com placar", () => {
    expect(computeScoreRows({ ...baseMatch, status: "cancelled" }, preds([
      { id: "p1", user_id: "u1", h: 2, a: 1 },
    ]))).toEqual({ kind: "delete" });
  });

  it("status='postponed' → kind: 'delete' mesmo com placar", () => {
    expect(computeScoreRows({ ...baseMatch, status: "postponed" }, [])).toEqual({ kind: "delete" });
  });

  it("lista vazia de palpites + resultado válido → upsert com rows: []", () => {
    expect(computeScoreRows(baseMatch, [])).toEqual({ kind: "upsert", rows: [] });
  });

  it("usa stage da partida na pontuação (group=7 vs final=34 para exato)", () => {
    const groupResult = computeScoreRows(baseMatch, preds([
      { id: "p1", user_id: "u1", h: 2, a: 1 },
    ]));
    const finalResult = computeScoreRows({ ...baseMatch, id: "match-2", stage: "final" }, preds([
      { id: "p2", user_id: "u1", h: 2, a: 1 },
    ]));
    if (groupResult.kind !== "upsert" || finalResult.kind !== "upsert") throw new Error();
    expect(groupResult.rows[0].points).toBe(7);
    expect(finalResult.rows[0].points).toBe(34);
  });
});
