import { describe, expect, it } from "vitest";
import {
  isZebraProne, pickZebra, buildRetrospectiva, rankVolatility,
  type ZebraCandidate,
} from "@/lib/scoring/retro-core";
import type { TimelinePoint } from "@/lib/scoring/raio-x-core";

const c = (over: Partial<ZebraCandidate>): ZebraCandidate => ({
  homeCode: "JOR", awayCode: "ALG", homeName: "Jordânia", awayName: "Argélia",
  tier: "exact", points: 7, ...over,
});

describe("isZebraProne", () => {
  it("dois times fora da lista de grandes = zebra-prone", () => {
    expect(isZebraProne("JOR", "ALG")).toBe(true);
  });
  it("jogo com um grande não é zebra-prone", () => {
    expect(isZebraProne("BRA", "ALG")).toBe(false);
    expect(isZebraProne("JOR", "FRA")).toBe(false);
  });
});

describe("pickZebra", () => {
  it("escolhe o melhor acerto (maior pontos) entre jogos zebra-prone", () => {
    const best = pickZebra([
      c({ points: 7, tier: "exact" }),
      c({ homeCode: "SEN", awayCode: "IRQ", points: 10, tier: "exact" }),
    ]);
    expect(best?.points).toBe(10);
  });
  it("ignora jogos com miss e jogos com time grande", () => {
    const z = pickZebra([
      c({ tier: "miss", points: 0 }),
      c({ homeCode: "BRA", awayCode: "MAR", tier: "exact", points: 7 }),
    ]);
    expect(z).toBeNull();
  });
  it("null quando não há acerto zebra-prone", () => {
    expect(pickZebra([])).toBeNull();
  });
});

const tl = (deltas: number[]): TimelinePoint[] =>
  deltas.map((delta, i) => ({
    day: `2026-06-${11 + i}`, rank: 10, cumulativePoints: 0,
    pointsThatDay: 0, matchesThatDay: 1, delta,
  }));

describe("rankVolatility", () => {
  it("soma os valores absolutos dos deltas", () => {
    expect(rankVolatility(tl([0, 3, -2, 5]))).toBe(10);
  });
});

describe("buildRetrospectiva", () => {
  it("monta persona, jornada e coletivo a partir dos sinais", () => {
    const r = buildRetrospectiva({
      highlights: {
        currentRank: 1, totalPlayers: 50, bestRank: 1, bestRankDay: "2026-07-01",
        biggestClimb: 4, biggestClimbDay: "2026-06-20", totalPoints: 120, exactsTotal: 8,
      },
      timeline: tl([0, 2, -1, 3]),
      exactsKnockout: 2, winnerOrDrawTotal: 30, predictionsScored: 40,
      zebra: null,
      collective: { players: 50, predictions: 2000, exacts: 300, matches: 104, days: 39 },
      hasData: true,
    });
    expect(r.persona.key).toBe("podio"); // rank 1
    expect(r.journey.totalPoints).toBe(120);
    expect(r.collective.players).toBe(50);
  });

  it("hasData=false força persona fallback (Fiel de Torcida)", () => {
    const r = buildRetrospectiva({
      highlights: {
        currentRank: 50, totalPlayers: 50, bestRank: 50, bestRankDay: "",
        biggestClimb: 0, biggestClimbDay: null, totalPoints: 0, exactsTotal: 0,
      },
      timeline: [], exactsKnockout: 0, winnerOrDrawTotal: 0, predictionsScored: 0,
      zebra: null,
      collective: { players: 50, predictions: 2000, exacts: 300, matches: 104, days: 39 },
      hasData: false,
    });
    expect(r.persona.key).toBe("fiel");
  });
});
