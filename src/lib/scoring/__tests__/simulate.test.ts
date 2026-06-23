import { describe, it, expect } from "vitest";
import { simulateMatchRanking } from "@/lib/scoring/simulate";
import type { RankingRow } from "@/lib/scoring/ranking-core";

const rk = (user_id: string, rank: number, over: Partial<RankingRow> = {}): RankingRow => ({
  user_id,
  display_name: user_id,
  avatar_url: null,
  paid: true,
  total_points: 0,
  exacts_total: 0,
  exacts_knockout: 0,
  winner_or_draw_total: 0,
  final_points: 0,
  semi_third_final_points: 0,
  rank,
  ...over,
});

describe("simulateMatchRanking", () => {
  it("placar exato dá os pontos do estágio e soma ao total", () => {
    const entries = [rk("a", 1, { total_points: 10 }), rk("b", 2, { total_points: 8 })];
    const predictions = new Map([["a", { home: 2, away: 1 }]]);
    const out = simulateMatchRanking({ entries, predictions, result: { home: 2, away: 1 }, stage: "group" });
    expect(out.get("a")!.points).toBe(7); // exact na fase de grupos
    expect(out.get("a")!.tier).toBe("exact");
    expect(out.get("a")!.total).toBe(17);
    expect(out.get("a")!.rank).toBe(1);
    expect(out.get("a")!.delta).toBe(0);
  });

  it("quem não palpitou recebe points null e total inalterado, mas ainda é ranqueado", () => {
    const entries = [rk("a", 1, { total_points: 10 }), rk("b", 2, { total_points: 8 })];
    const predictions = new Map([["a", { home: 0, away: 0 }]]);
    const out = simulateMatchRanking({ entries, predictions, result: { home: 1, away: 0 }, stage: "group" });
    expect(out.get("b")!.points).toBeNull();
    expect(out.get("b")!.tier).toBeNull();
    expect(out.get("b")!.total).toBe(8);
    expect(out.get("b")!.rank).toBe(2);
  });

  it("reordena e calcula delta quando b ultrapassa a", () => {
    const entries = [rk("a", 1, { total_points: 10 }), rk("b", 2, { total_points: 9 })];
    const predictions = new Map([
      ["a", { home: 0, away: 0 }], // empate previsto vs jogo com vencedor → miss (0 pts)
      ["b", { home: 3, away: 1 }], // exato na final → +34
    ]);
    const out = simulateMatchRanking({ entries, predictions, result: { home: 3, away: 1 }, stage: "final" });
    expect(out.get("b")!.points).toBe(34);
    expect(out.get("b")!.total).toBe(43);
    expect(out.get("b")!.rank).toBe(1);
    expect(out.get("b")!.delta).toBe(1); // subiu de 2 → 1
    expect(out.get("a")!.points).toBe(0);
    expect(out.get("a")!.rank).toBe(2);
    expect(out.get("a")!.delta).toBe(-1); // caiu de 1 → 2
  });

  it("não modifica os entries de entrada (imutável)", () => {
    const entries = [rk("a", 1, { total_points: 10 })];
    const predictions = new Map([["a", { home: 1, away: 0 }]]);
    simulateMatchRanking({ entries, predictions, result: { home: 1, away: 0 }, stage: "group" });
    expect(entries[0].total_points).toBe(10);
  });

  it("empate em total → desempate pela regra oficial (mais exacts_total vence)", () => {
    // Após a simulação a e b empatam em 12 pontos; a fez o placar exato, b só
    // acertou o vencedor — a deve ficar à frente por exacts_total.
    const entries = [rk("a", 2, { total_points: 5 }), rk("b", 1, { total_points: 10 })];
    const predictions = new Map([
      ["a", { home: 2, away: 1 }], // exato → +7 (group) → 12, exacts_total 1
      ["b", { home: 5, away: 0 }], // só vencedor → +2 (group) → 12, exacts_total 0
    ]);
    const out = simulateMatchRanking({ entries, predictions, result: { home: 2, away: 1 }, stage: "group" });
    expect(out.get("a")!.total).toBe(12);
    expect(out.get("b")!.total).toBe(12);
    expect(out.get("a")!.rank).toBe(1); // desempata por exacts_total
    expect(out.get("b")!.rank).toBe(2);
    expect(out.get("a")!.delta).toBe(1); // subiu de 2 → 1
    expect(out.get("b")!.delta).toBe(-1); // caiu de 1 → 2
  });
});
