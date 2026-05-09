import { describe, it, expect } from "vitest";
import { score } from "@/lib/scoring";

const m = (h: number, a: number) => ({ home_score: h, away_score: a });

describe("score() — exemplos numerados do regulamento", () => {
  it("§7.1: acerto do vencedor (Brasil 2x1, palpite 1x0) — group", () => {
    expect(score({ prediction: m(1, 0), match: m(2, 1), stage: "group" }))
      .toEqual({ points: 2, tier: "winner_or_draw" });
  });

  it("§7.2 ex.1: vencedor + gols (2x1 real, palpite 3x1) — group", () => {
    expect(score({ prediction: m(3, 1), match: m(2, 1), stage: "group" }))
      .toEqual({ points: 4, tier: "winner_or_draw" });
  });

  it("§7.2 ex.2: vencedor + 0 gols conta (1x0 real, palpite 2x0) — group", () => {
    expect(score({ prediction: m(2, 0), match: m(1, 0), stage: "group" }))
      .toEqual({ points: 4, tier: "winner_or_draw" });
  });

  it("§7.3: placar exato (2x1 real, palpite 2x1) — group", () => {
    expect(score({ prediction: m(2, 1), match: m(2, 1), stage: "group" }))
      .toEqual({ points: 7, tier: "exact" });
  });

  it("§8 ex.1: acerto do empate sem placar exato (1x1 real, palpite 2x2) — group", () => {
    expect(score({ prediction: m(2, 2), match: m(1, 1), stage: "group" }))
      .toEqual({ points: 2, tier: "winner_or_draw" });
  });

  it("§8 ex.2: placar exato em empate (1x1 real, palpite 1x1) — group", () => {
    expect(score({ prediction: m(1, 1), match: m(1, 1), stage: "group" }))
      .toEqual({ points: 7, tier: "exact" });
  });
});

describe("score() — casos de borda", () => {
  it("vencedor invertido vale 0 (Brasil 2x1, palpite 1x2)", () => {
    expect(score({ prediction: m(1, 2), match: m(2, 1), stage: "group" }))
      .toEqual({ points: 0, tier: "miss" });
  });

  it("palpite de empate em jogo decidido vale 0 (2x1 real, palpite 1x1)", () => {
    expect(score({ prediction: m(1, 1), match: m(2, 1), stage: "group" }))
      .toEqual({ points: 0, tier: "miss" });
  });

  it("palpite com vencedor em jogo empatado vale 0 (1x1 real, palpite 2x1)", () => {
    expect(score({ prediction: m(2, 1), match: m(1, 1), stage: "group" }))
      .toEqual({ points: 0, tier: "miss" });
  });

  it("0x0 exato (group)", () => {
    expect(score({ prediction: m(0, 0), match: m(0, 0), stage: "group" }))
      .toEqual({ points: 7, tier: "exact" });
  });

  it("0x0 real, palpite 1x1 — acerto do empate", () => {
    expect(score({ prediction: m(1, 1), match: m(0, 0), stage: "group" }))
      .toEqual({ points: 2, tier: "winner_or_draw" });
  });
});
