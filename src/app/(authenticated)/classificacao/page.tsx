import { loadRanking } from "@/lib/scoring/ranking";
import { PremiacaoNote } from "@/app/(authenticated)/_components/premiacao-note";
import { RankingPodium } from "./_components/ranking-podium";
import { RankingList } from "./_components/ranking-list";

export default async function ClassificacaoPage() {
  const rows = await loadRanking();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Bolão Copa 2026
        </p>
        <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
          Ranking
        </h1>
        <p className="text-muted-foreground">
          {rows.length} {rows.length === 1 ? "participante" : "participantes"}.
          Atualizada conforme resultados oficiais são registrados.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          A classificação aparecerá aqui assim que os primeiros resultados forem
          registrados.
        </p>
      ) : (
        <>
          <RankingPodium rows={rows.slice(0, 3)} />
          <RankingList rows={rows.slice(3)} />
          <PremiacaoNote />
        </>
      )}
    </main>
  );
}
