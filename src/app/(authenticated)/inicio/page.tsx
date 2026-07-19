import { redirect } from "next/navigation";
import { RankingPreview } from "./_components/ranking-preview";
import { UpcomingMatchesSection } from "./_components/upcoming-matches-section";
import { SuaPosicaoCard } from "./_components/sua-posicao-card";
import { AvisosCard } from "./_components/avisos-card";
import { RetroBanner } from "./_components/retro-banner";
import { isFinalDecided } from "@/lib/matches/final-status";

export default async function InicioPage() {
  if (await isFinalDecided()) redirect("/classificacao");

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Sua rodada
          </p>
          <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
            Bem-vindo ao bolão
          </h1>
          <p className="text-muted-foreground">
            Confira seus próximos jogos, dê palpite e acompanhe o ranking.
          </p>
        </div>
      </header>

      <RetroBanner />

      <section className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <UpcomingMatchesSection />

        <div className="flex flex-col gap-5">
          <SuaPosicaoCard />
          <AvisosCard />
        </div>
      </section>

      <section className="mt-10">
        <RankingPreview />
      </section>
    </main>
  );
}
