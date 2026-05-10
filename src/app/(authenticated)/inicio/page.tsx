import { Flame, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RankingPreview } from "./_components/ranking-preview";
import { UpcomingMatchesSection } from "./_components/upcoming-matches-section";

export default function InicioPage() {
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
        <Badge variant="upcoming" className="h-7 px-3 text-xs">
          Pré-Copa
        </Badge>
      </header>

      <section className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <UpcomingMatchesSection />

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 font-heading text-xl tracking-wide">
                <Trophy className="size-5 text-primary" />
                Sua posição
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              <span className="font-heading text-6xl text-primary tabular leading-none">
                #—
              </span>
              <span className="text-sm text-muted-foreground">
                Você ainda não palpitou. Comece pela primeira partida para
                entrar no ranking.
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 font-heading text-xl tracking-wide">
                <Flame className="size-5 text-primary" />
                Aposta da rodada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-10">
        <RankingPreview />
      </section>
    </main>
  );
}
