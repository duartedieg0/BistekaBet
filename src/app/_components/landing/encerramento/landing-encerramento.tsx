// src/app/_components/landing/encerramento/landing-encerramento.tsx
import { loadPublicRanking } from "@/lib/scoring/ranking";
import { loadCollectiveStats } from "@/lib/scoring/collective";
import { pickChampions } from "@/lib/scoring/collective-core";
import { COMPETITION } from "@/lib/bolao-config";
import { RankingPodium } from "@/app/(authenticated)/classificacao/_components/ranking-podium";
import { RankingList } from "@/app/(authenticated)/classificacao/_components/ranking-list";
import { ChampionHero } from "./champion-hero";
import { NumbersSection } from "./numbers-section";
import { FinalCtaEncerramento } from "./final-cta-encerramento";

/** Dias corridos da competição (inclusivo). ~39 para 11 jun → 19 jul. */
function competitionDays(): number {
  const start = new Date(`${COMPETITION.startDate}T00:00:00Z`).getTime();
  const end = new Date(`${COMPETITION.endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000) + 1;
}

export async function LandingEncerramento({
  errorMessage,
}: {
  errorMessage?: string | null;
}) {
  const [rows, counts] = await Promise.all([
    loadPublicRanking(),
    loadCollectiveStats(),
  ]);
  const champions = pickChampions(rows);

  return (
    <main className="flex flex-col">
      <ChampionHero champions={champions} errorMessage={errorMessage} />

      {rows.length === 0 ? (
        <section className="mx-auto w-full max-w-3xl px-6 py-24 text-center text-muted-foreground">
          A classificação final aparecerá aqui assim que os resultados forem
          registrados.
        </section>
      ) : (
        <>
          <section className="mx-auto w-full max-w-7xl px-6 py-16">
            <RankingPodium rows={rows.slice(0, 3)} />
          </section>

          <NumbersSection
            players={counts.players}
            predictions={counts.predictions}
            exacts={counts.exacts}
            days={competitionDays()}
          />

          <section
            id="classificacao"
            className="mx-auto w-full max-w-7xl scroll-mt-20 px-6 py-16"
          >
            <header className="mb-8 flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Bolão Copa 2026
              </p>
              <h2 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
                Classificação final
              </h2>
              <p className="text-muted-foreground">
                {rows.length}{" "}
                {rows.length === 1 ? "participante" : "participantes"}.
              </p>
            </header>
            <RankingList rows={rows.slice(3)} />
          </section>
        </>
      )}

      <FinalCtaEncerramento />
    </main>
  );
}
