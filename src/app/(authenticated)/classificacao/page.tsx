import { loadRanking } from "@/lib/scoring/ranking";
import { RankingTable } from "@/app/(authenticated)/inicio/_components/ranking-table";

export default async function ClassificacaoPage() {
  const rows = await loadRanking();

  return (
    <main className="container mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Bolão Copa 2026
        </p>
        <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
          Classificação
        </h1>
        <p className="text-muted-foreground">
          {rows.length} {rows.length === 1 ? "participante" : "participantes"}.
          Atualizada conforme resultados oficiais são registrados.
        </p>
      </header>
      <RankingTable rows={rows} />
    </main>
  );
}
