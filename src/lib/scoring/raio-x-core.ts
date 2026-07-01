import type { Stage } from "@/lib/types/match";
import type { Tier } from "@/lib/scoring";
import {
  applyScoreToEntry,
  assignRanks,
  compareForRanking,
  type ProfileRow,
  type RankingEntry,
} from "./ranking-core";

export type RaioXScore = {
  user_id: string;
  points: number;
  tier: Tier;
  stage: Stage;
  day: string; // YYYY-MM-DD (dia São Paulo)
};

export type TimelinePoint = {
  day: string;
  rank: number;
  cumulativePoints: number;
  pointsThatDay: number;   // pontos do usuário nesse dia
  matchesThatDay: number;  // qtd de scores DO USUÁRIO nesse dia
  delta: number;           // rank do dia anterior - rank do dia (dia 1 = 0)
};

export type RaioXHighlights = {
  currentRank: number;
  totalPlayers: number;
  bestRank: number;
  bestRankDay: string;
  biggestClimb: number;
  biggestClimbDay: string | null;
  totalPoints: number;
  exactsTotal: number;
};

export type RaioXResult = {
  timeline: TimelinePoint[];
  highlights: RaioXHighlights;
  hasData: boolean;
};

function initEntry(p: ProfileRow): RankingEntry {
  return {
    user_id: p.id,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    paid: p.paid,
    total_points: 0,
    exacts_total: 0,
    exacts_knockout: 0,
    winner_or_draw_total: 0,
    final_points: 0,
    semi_third_final_points: 0,
  };
}

export function buildRaioXTimeline(input: {
  userId: string;
  profiles: ProfileRow[];
  scores: RaioXScore[];
}): RaioXResult {
  const { userId, profiles, scores } = input;
  const totalPlayers = profiles.length;

  const entries = new Map<string, RankingEntry>();
  for (const p of profiles) entries.set(p.id, initEntry(p));

  const byDay = new Map<string, RaioXScore[]>();
  for (const s of scores) {
    const arr = byDay.get(s.day);
    if (arr) arr.push(s);
    else byDay.set(s.day, [s]);
  }
  const days = [...byDay.keys()].sort();

  const timeline: TimelinePoint[] = [];
  let prevRank: number | null = null;

  for (const day of days) {
    let pointsThatDay = 0;
    let matchesThatDay = 0;
    for (const s of byDay.get(day)!) {
      const entry = entries.get(s.user_id);
      if (!entry) continue; // score órfão
      applyScoreToEntry(entry, { points: s.points, tier: s.tier, stage: s.stage });
      if (s.user_id === userId) {
        pointsThatDay += s.points;
        matchesThatDay += 1;
      }
    }

    const ranked = assignRanks([...entries.values()].sort(compareForRanking));
    const me = ranked.find((r) => r.user_id === userId);
    const rank = me ? me.rank : totalPlayers;
    const cumulativePoints = me ? me.total_points : 0;
    const delta = prevRank === null ? 0 : prevRank - rank;

    timeline.push({ day, rank, cumulativePoints, pointsThatDay, matchesThatDay, delta });
    prevRank = rank;
  }

  const myEntry = entries.get(userId);
  const totalPoints = myEntry?.total_points ?? 0;
  const exactsTotal = myEntry?.exacts_total ?? 0;
  const last = timeline[timeline.length - 1];

  // Seed com Infinity para a PRIMEIRA ocorrência do menor rank vencer (o loop só
  // atualiza em melhora estrita). bestRankDay="" só é alcançável com timeline
  // vazia, e nesse caso hasData=false (a página nem lê highlights).
  let bestRank = timeline.length ? Infinity : totalPlayers;
  let bestRankDay = last ? last.day : "";
  let biggestClimb = 0;
  let biggestClimbDay: string | null = null;
  for (const pt of timeline) {
    if (pt.rank < bestRank) {
      bestRank = pt.rank;
      bestRankDay = pt.day;
    }
    if (pt.delta > biggestClimb) {
      biggestClimb = pt.delta;
      biggestClimbDay = pt.day;
    }
  }

  return {
    timeline,
    highlights: {
      currentRank: last ? last.rank : totalPlayers,
      totalPlayers,
      bestRank,
      bestRankDay,
      biggestClimb,
      biggestClimbDay,
      totalPoints,
      exactsTotal,
    },
    hasData: totalPoints > 0,
  };
}
