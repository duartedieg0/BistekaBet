import { redirect } from "next/navigation";
import Link from "next/link";
import { Target, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { loadSuaPosicaoData } from "../_lib/sua-posicao-queries";

export async function SuaPosicaoCard() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const { rank, totalPlayers, totalPoints, exactCount } = await loadSuaPosicaoData(
    userData.user.id,
  );
  const hasPalpitado = totalPoints > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 font-heading text-xl tracking-wide">
          <Trophy className="size-5 text-primary" />
          Sua posição
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-6xl text-primary tabular leading-none">
            {hasPalpitado ? `#${rank}` : "#—"}
          </span>
          {hasPalpitado ? (
            <span className="text-sm text-muted-foreground">
              de {totalPlayers}
            </span>
          ) : null}
        </div>
        {hasPalpitado ? (
          <span
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
            aria-label={`${exactCount} na mosca`}
          >
            <Target className="size-4 text-primary" aria-hidden />
            {exactCount} Na mosca
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            Você ainda não palpitou. Comece pela primeira partida para entrar no
            ranking.
          </span>
        )}
        {hasPalpitado && (
          <Link
            href="/raio-x"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver meu raio-x →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
