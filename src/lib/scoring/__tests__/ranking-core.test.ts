import { describe, it, expect } from "vitest";
import {
  aggregate,
  compareForRanking,
  assignRanks,
  type ProfileRow,
  type ScoreWithStageRow,
  type RankingEntry,
} from "@/lib/scoring/ranking-core";

const profile = (id: string, name = id, paid = true): ProfileRow => ({
  id, display_name: name, avatar_url: null, paid,
});

const s = (user_id: string, points: number, tier: "exact" | "winner_or_draw" | "miss", stage: ScoreWithStageRow["stage"]): ScoreWithStageRow =>
  ({ user_id, points, tier, stage });

const baseEntry = (over: Partial<RankingEntry> = {}): RankingEntry => ({
  user_id: "x",
  display_name: "X",
  avatar_url: null,
  paid: true,
  total_points: 0,
  exacts_total: 0,
  exacts_knockout: 0,
  winner_or_draw_total: 0,
  final_points: 0,
  semi_third_final_points: 0,
  ...over,
});

describe("aggregate", () => {
  it("sem scores → todos os perfis aparecem zerados (§3, §11)", () => {
    const r = aggregate([profile("u1"), profile("u2")], []);
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.total_points === 0)).toBe(true);
    expect(r.map((x) => x.rank)).toEqual([1, 1]);
  });

  it("ordena desc por total_points (§11)", () => {
    const r = aggregate(
      [profile("a"), profile("b"), profile("c")],
      [s("a", 7, "exact", "group"), s("b", 4, "winner_or_draw", "group")],
    );
    expect(r.map((x) => x.user_id)).toEqual(["a", "b", "c"]);
  });

  it("score órfão (user sem profile) é ignorado", () => {
    const r = aggregate([profile("a")], [s("ghost", 7, "exact", "group")]);
    expect(r).toHaveLength(1);
    expect(r[0].total_points).toBe(0);
  });

  it("contabiliza exacts_total, exacts_knockout, winner_or_draw_total, final_points, semi_third_final_points", () => {
    const r = aggregate([profile("a")], [
      s("a", 7,  "exact",          "group"),
      s("a", 13, "exact",          "round_of_16"),
      s("a", 4,  "winner_or_draw", "group"),
      s("a", 0,  "miss",           "group"),
      s("a", 25, "exact",          "semi"),
      s("a", 22, "exact",          "third_place"),
      s("a", 34, "exact",          "final"),
    ]);
    const a = r[0];
    expect(a.total_points).toBe(7 + 13 + 4 + 0 + 25 + 22 + 34);
    expect(a.exacts_total).toBe(5);
    expect(a.exacts_knockout).toBe(4);
    expect(a.winner_or_draw_total).toBe(6);
    expect(a.final_points).toBe(34);
    expect(a.semi_third_final_points).toBe(25 + 22 + 34);
  });
});

describe("compareForRanking — §12 critérios em cascata", () => {
  it("§12.1: empate em total → mais exacts_total vence", () => {
    const a = baseEntry({ user_id: "a", total_points: 10, exacts_total: 2 });
    const b = baseEntry({ user_id: "b", total_points: 10, exacts_total: 1 });
    expect(compareForRanking(a, b)).toBeLessThan(0);
  });

  it("§12.2: empate em §12.1 → mais exacts_knockout vence", () => {
    const a = baseEntry({ total_points: 10, exacts_total: 2, exacts_knockout: 2 });
    const b = baseEntry({ total_points: 10, exacts_total: 2, exacts_knockout: 1 });
    expect(compareForRanking(a, b)).toBeLessThan(0);
  });

  it("§12.3: empate em §12.2 → mais winner_or_draw_total vence", () => {
    const a = baseEntry({ total_points: 10, exacts_total: 2, exacts_knockout: 1, winner_or_draw_total: 5 });
    const b = baseEntry({ total_points: 10, exacts_total: 2, exacts_knockout: 1, winner_or_draw_total: 4 });
    expect(compareForRanking(a, b)).toBeLessThan(0);
  });

  it("§12.4: empate em §12.3 → mais final_points vence", () => {
    const a = baseEntry({ total_points: 10, exacts_total: 0, exacts_knockout: 0, winner_or_draw_total: 5, final_points: 25 });
    const b = baseEntry({ total_points: 10, exacts_total: 0, exacts_knockout: 0, winner_or_draw_total: 5, final_points: 11 });
    expect(compareForRanking(a, b)).toBeLessThan(0);
  });

  it("§12.5: empate em §12.4 → mais semi_third_final_points vence", () => {
    const a = baseEntry({ total_points: 10, exacts_total: 0, exacts_knockout: 0, winner_or_draw_total: 5, final_points: 0, semi_third_final_points: 30 });
    const b = baseEntry({ total_points: 10, exacts_total: 0, exacts_knockout: 0, winner_or_draw_total: 5, final_points: 0, semi_third_final_points: 15 });
    expect(compareForRanking(a, b)).toBeLessThan(0);
  });

  it("§12.6: empate em todos os critérios → 0 (sorteio externo)", () => {
    const a = baseEntry({ user_id: "a" });
    const b = baseEntry({ user_id: "b" });
    expect(compareForRanking(a, b)).toBe(0);
  });
});

describe("assignRanks", () => {
  it("empates compartilham rank (1, 2, 2, 4)", () => {
    const sorted: RankingEntry[] = [
      baseEntry({ user_id: "a", total_points: 10 }),
      baseEntry({ user_id: "b", total_points: 5 }),
      baseEntry({ user_id: "c", total_points: 5 }),
      baseEntry({ user_id: "d", total_points: 1 }),
    ];
    const r = assignRanks(sorted);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 2, 4]);
  });

  it("KNOCKOUT_STAGES não inclui group (§12 último parágrafo)", () => {
    const r = aggregate([profile("a")], [
      s("a", 7, "exact", "group"),
      s("a", 7, "exact", "round_of_32"),
    ]);
    expect(r[0].exacts_total).toBe(2);
    expect(r[0].exacts_knockout).toBe(1);
  });
});
