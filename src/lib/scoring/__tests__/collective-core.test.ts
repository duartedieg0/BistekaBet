import { describe, it, expect } from "vitest";
import { pickChampions } from "@/lib/scoring/collective-core";
import type { RankingRow } from "@/lib/scoring/ranking-core";

const row = (over: Partial<RankingRow> = {}): RankingRow => ({
  user_id: "u",
  display_name: "U",
  avatar_url: null,
  paid: true,
  total_points: 0,
  exacts_total: 0,
  exacts_knockout: 0,
  winner_or_draw_total: 0,
  final_points: 0,
  semi_third_final_points: 0,
  rank: 1,
  ...over,
});

describe("pickChampions", () => {
  it("lista vazia → []", () => {
    expect(pickChampions([])).toEqual([]);
  });

  it("um único rank 1 → só ele", () => {
    const r = [row({ user_id: "a", rank: 1 }), row({ user_id: "b", rank: 2 })];
    expect(pickChampions(r).map((x) => x.user_id)).toEqual(["a"]);
  });

  it("empate no 1º → todos os rank 1", () => {
    const r = [
      row({ user_id: "a", rank: 1 }),
      row({ user_id: "b", rank: 1 }),
      row({ user_id: "c", rank: 3 }),
    ];
    expect(pickChampions(r).map((x) => x.user_id)).toEqual(["a", "b"]);
  });

  it("nenhum rank 1 (defensivo) → []", () => {
    expect(pickChampions([row({ user_id: "a", rank: 2 })])).toEqual([]);
  });
});
