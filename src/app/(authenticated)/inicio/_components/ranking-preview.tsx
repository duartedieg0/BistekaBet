import Link from "next/link";
import { loadRanking } from "@/lib/scoring/ranking";
import { RankingTable } from "./ranking-table";

export async function RankingPreview() {
  const rows = await loadRanking();
  const top10 = rows.slice(0, 10);

  return (
    <section id="ranking" className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-4">
        <h2 className="font-heading text-3xl tracking-wide">Ranking</h2>
        <Link
          href="/classificacao"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Ver classificação completa →
        </Link>
      </header>
      <RankingTable rows={top10} />
    </section>
  );
}
