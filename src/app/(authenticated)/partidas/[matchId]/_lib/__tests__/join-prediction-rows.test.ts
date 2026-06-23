import { describe, expect, it } from "vitest";
import { joinPredictionRows } from "../join-prediction-rows";
import type { RankingRow } from "@/lib/scoring/ranking-core";

function rk(
  user_id: string,
  display_name: string,
  rank: number,
  avatar_url: string | null = null,
): RankingRow {
  return {
    user_id,
    display_name,
    avatar_url,
    paid: true,
    total_points: 0,
    exacts_total: 0,
    exacts_knockout: 0,
    winner_or_draw_total: 0,
    final_points: 0,
    semi_third_final_points: 0,
    rank,
  };
}

describe("joinPredictionRows", () => {
  const ranking = [
    rk("u1", "Ana", 1),
    rk("u2", "Bruno", 2),
    rk("u3", "Carlos", 3),
  ];

  it("preserva ordem do ranking", () => {
    const rows = joinPredictionRows({
      ranking,
      predictions: [],
      scores: [],
    });
    expect(rows.map((r) => r.user_id)).toEqual(["u1", "u2", "u3"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("anexa palpite quando o usuário palpitou", () => {
    const rows = joinPredictionRows({
      ranking,
      predictions: [
        { user_id: "u2", home_score: 2, away_score: 1 },
      ],
      scores: [],
    });
    expect(rows.find((r) => r.user_id === "u2")?.prediction).toEqual({
      home_score: 2,
      away_score: 1,
    });
    expect(rows.find((r) => r.user_id === "u1")?.prediction).toBeNull();
  });

  it("anexa score quando há pontuação para o usuário", () => {
    const rows = joinPredictionRows({
      ranking,
      predictions: [
        { user_id: "u1", home_score: 2, away_score: 1 },
      ],
      scores: [
        { user_id: "u1", points: 5, tier: "exact" },
      ],
    });
    expect(rows.find((r) => r.user_id === "u1")?.score).toEqual({
      points: 5,
      tier: "exact",
    });
    expect(rows.find((r) => r.user_id === "u2")?.score).toBeNull();
  });

  it("quando não há scores, todos têm score null", () => {
    const rows = joinPredictionRows({
      ranking,
      predictions: [
        { user_id: "u1", home_score: 1, away_score: 1 },
        { user_id: "u2", home_score: 0, away_score: 0 },
      ],
      scores: [],
    });
    expect(rows.every((r) => r.score === null)).toBe(true);
  });

  it("ignora palpites/scores de usuários fora do ranking", () => {
    const rows = joinPredictionRows({
      ranking,
      predictions: [
        { user_id: "outsider", home_score: 9, away_score: 9 },
      ],
      scores: [
        { user_id: "outsider", points: 99, tier: "exact" },
      ],
    });
    expect(rows.map((r) => r.user_id)).toEqual(["u1", "u2", "u3"]);
  });

  it("embute o entry (RankingRow de origem) em cada linha", () => {
    const rows = joinPredictionRows({ ranking, predictions: [], scores: [] });
    expect(rows[0].entry).toEqual(ranking[0]);
    expect(rows[1].entry.user_id).toBe("u2");
    expect(rows[2].entry.total_points).toBe(0);
  });
});
