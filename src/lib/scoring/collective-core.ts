import type { RankingRow } from "@/lib/scoring/ranking-core";

/**
 * Retorna todos os participantes empatados no 1º lugar (rank === 1).
 * Empates aparecem como co-campeões. `assignRanks` garante rank === 1 para todos
 * os empatados no topo.
 */
export function pickChampions(rows: RankingRow[]): RankingRow[] {
  return rows.filter((r) => r.rank === 1);
}
