import type { Tier } from "@/lib/scoring/score";
import type { RaioXHighlights, TimelinePoint } from "@/lib/scoring/raio-x-core";
import { derivePersona, type Persona, type PersonaSignals } from "@/lib/retro/personas";

// --- Zebra (heurístico: sem odds, "grande" = seleção tradicional por código FIFA) ---

export const TRADITIONAL_POWERS: ReadonlySet<string> = new Set([
  "BRA", "ARG", "FRA", "ESP", "GER", "POR", "NED", "ENG",
]);

export type ZebraCandidate = {
  homeCode: string;
  awayCode: string;
  homeName: string;
  awayName: string;
  tier: Tier;
  points: number;
};

export function isZebraProne(homeCode: string, awayCode: string): boolean {
  return !TRADITIONAL_POWERS.has(homeCode) && !TRADITIONAL_POWERS.has(awayCode);
}

const TIER_RANK: Record<Tier, number> = { exact: 2, winner_or_draw: 1, miss: 0 };

export function pickZebra(candidates: ZebraCandidate[]): ZebraCandidate | null {
  const zebras = candidates.filter(
    (z) => z.tier !== "miss" && isZebraProne(z.homeCode, z.awayCode),
  );
  if (zebras.length === 0) return null;
  return zebras
    .slice()
    .sort((a, b) => b.points - a.points || TIER_RANK[b.tier] - TIER_RANK[a.tier])[0];
}

// --- Montagem da retrospectiva ---

export type CollectiveStats = {
  players: number; predictions: number; exacts: number; matches: number; days: number;
};

export type RetroJourney = {
  currentRank: number; totalPlayers: number;
  totalPoints: number; exactsTotal: number;
  bestRank: number; bestRankDay: string;
  biggestClimb: number; biggestClimbDay: string | null;
};

export type Retrospectiva = {
  persona: Persona;
  journey: RetroJourney;
  timeline: TimelinePoint[];
  collective: CollectiveStats;
  zebra: ZebraCandidate | null;
  hasData: boolean;
};

export function rankVolatility(timeline: TimelinePoint[]): number {
  return timeline.reduce((sum, p) => sum + Math.abs(p.delta), 0);
}

export function buildRetrospectiva(input: {
  highlights: RaioXHighlights;
  timeline: TimelinePoint[];
  exactsKnockout: number;
  winnerOrDrawTotal: number;
  predictionsScored: number;
  zebra: ZebraCandidate | null;
  collective: CollectiveStats;
  hasData: boolean;
}): Retrospectiva {
  const { highlights: h, timeline, hasData } = input;
  const firstRank = timeline.length ? timeline[0].rank : h.totalPlayers;

  const signals: PersonaSignals = {
    currentRank: h.currentRank,
    totalPlayers: h.totalPlayers,
    totalPoints: h.totalPoints,
    exactsTotal: h.exactsTotal,
    exactsKnockout: input.exactsKnockout,
    winnerOrDrawTotal: input.winnerOrDrawTotal,
    predictionsScored: input.predictionsScored,
    firstRank,
    rankVolatility: rankVolatility(timeline),
  };

  // Sem dados: nunca uma persona competitiva. Força o fallback carinhoso.
  const persona = hasData
    ? derivePersona(signals)
    : derivePersona({ ...signals, currentRank: h.totalPlayers, exactsTotal: 0,
        predictionsScored: 0, rankVolatility: 0, firstRank: h.totalPlayers });

  return {
    persona,
    journey: {
      currentRank: h.currentRank, totalPlayers: h.totalPlayers,
      totalPoints: h.totalPoints, exactsTotal: h.exactsTotal,
      bestRank: h.bestRank, bestRankDay: h.bestRankDay,
      biggestClimb: h.biggestClimb, biggestClimbDay: h.biggestClimbDay,
    },
    timeline,
    collective: input.collective,
    zebra: input.zebra,
    hasData,
  };
}
