import { describe, it, expect } from "vitest";
import { buildRaioXTimeline, type RaioXScore } from "@/lib/scoring/raio-x-core";
import type { ProfileRow } from "@/lib/scoring/ranking-core";

const profile = (id: string): ProfileRow => ({
  id, display_name: id, avatar_url: null, paid: true,
});

const sc = (
  user_id: string, points: number,
  tier: RaioXScore["tier"], stage: RaioXScore["stage"], day: string,
): RaioXScore => ({ user_id, points, tier, stage, day });

const base: RaioXScore[] = [
  sc("a", 7, "exact", "group", "2026-06-11"),
  sc("b", 4, "winner_or_draw", "group", "2026-06-11"),
  sc("b", 10, "exact", "group", "2026-06-12"),
  sc("a", 13, "exact", "round_of_16", "2026-06-13"),
];

describe("buildRaioXTimeline", () => {
  it("reconstrói rank e pontos acumulados por dia", () => {
    const { timeline } = buildRaioXTimeline({
      userId: "a", profiles: [profile("a"), profile("b")], scores: base,
    });
    expect(timeline.map((t) => t.day)).toEqual(["2026-06-11", "2026-06-12", "2026-06-13"]);
    expect(timeline.map((t) => t.rank)).toEqual([1, 2, 1]);
    expect(timeline.map((t) => t.cumulativePoints)).toEqual([7, 7, 20]);
    expect(timeline.map((t) => t.pointsThatDay)).toEqual([7, 0, 13]);
    expect(timeline.map((t) => t.matchesThatDay)).toEqual([1, 0, 1]);
  });

  it("delta: dia 1 = 0, desceu = negativo, subiu = positivo", () => {
    const { timeline } = buildRaioXTimeline({
      userId: "a", profiles: [profile("a"), profile("b")], scores: base,
    });
    expect(timeline.map((t) => t.delta)).toEqual([0, -1, 1]);
  });

  it("highlights: currentRank, bestRank(+dia), biggestClimb(+dia), totais", () => {
    const { highlights } = buildRaioXTimeline({
      userId: "a", profiles: [profile("a"), profile("b")], scores: base,
    });
    expect(highlights.currentRank).toBe(1);
    expect(highlights.totalPlayers).toBe(2);
    expect(highlights.bestRank).toBe(1);
    expect(highlights.bestRankDay).toBe("2026-06-11");
    expect(highlights.biggestClimb).toBe(1);
    expect(highlights.biggestClimbDay).toBe("2026-06-13");
    expect(highlights.totalPoints).toBe(20);
    expect(highlights.exactsTotal).toBe(2);
  });

  it("invariantes: último rank = currentRank; bestRank = min; totalPoints = última soma", () => {
    const { timeline, highlights } = buildRaioXTimeline({
      userId: "a", profiles: [profile("a"), profile("b")], scores: base,
    });
    const last = timeline[timeline.length - 1];
    expect(last.rank).toBe(highlights.currentRank);
    expect(highlights.bestRank).toBe(Math.min(...timeline.map((t) => t.rank)));
    expect(highlights.totalPoints).toBe(last.cumulativePoints);
  });

  it("hasData=false quando o usuário não somou pontos (mesmo com outros pontuando)", () => {
    const r = buildRaioXTimeline({
      userId: "c", profiles: [profile("a"), profile("b"), profile("c")], scores: base,
    });
    expect(r.hasData).toBe(false);
    expect(r.highlights.totalPoints).toBe(0);
  });

  it("hasData=false e timeline vazia quando não há scores", () => {
    const r = buildRaioXTimeline({
      userId: "a", profiles: [profile("a")], scores: [],
    });
    expect(r.hasData).toBe(false);
    expect(r.timeline).toEqual([]);
  });

  it("biggestClimbDay = null quando o usuário nunca subiu", () => {
    const scores: RaioXScore[] = [
      sc("a", 7, "exact", "group", "2026-06-11"),
      sc("b", 34, "exact", "final", "2026-06-12"),
    ];
    const { highlights } = buildRaioXTimeline({
      userId: "a", profiles: [profile("a"), profile("b")], scores,
    });
    expect(highlights.biggestClimb).toBe(0);
    expect(highlights.biggestClimbDay).toBeNull();
  });

  it("empates de rank usam os critérios do ranking-core (desempate por exacts)", () => {
    const scores: RaioXScore[] = [
      sc("a", 7, "exact", "group", "2026-06-11"),
      sc("b", 7, "winner_or_draw", "group", "2026-06-11"),
    ];
    const rA = buildRaioXTimeline({ userId: "a", profiles: [profile("a"), profile("b")], scores });
    const rB = buildRaioXTimeline({ userId: "b", profiles: [profile("a"), profile("b")], scores });
    expect(rA.highlights.currentRank).toBe(1);
    expect(rB.highlights.currentRank).toBe(2);
  });

  it("score órfão (user fora de profiles) é ignorado", () => {
    const scores: RaioXScore[] = [
      sc("a", 7, "exact", "group", "2026-06-11"),
      sc("ghost", 99, "exact", "final", "2026-06-11"),
    ];
    const r = buildRaioXTimeline({ userId: "a", profiles: [profile("a")], scores });
    expect(r.highlights.currentRank).toBe(1);
    expect(r.highlights.totalPoints).toBe(7);
  });
});
