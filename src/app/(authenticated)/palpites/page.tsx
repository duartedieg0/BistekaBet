import { CalendarX } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { STAGES, type Stage } from "@/lib/types/match";
import { StageTabs } from "./_components/stage-tabs";
import { MatchPredictionCard } from "./_components/match-prediction-card";
import { GroupSaveForm } from "./_components/group-save-form";
import { getMatchesWithPredictions } from "./_lib/queries";

export default async function PalpitesPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; group?: string }>;
}) {
  const sp = await searchParams;
  const stage = (STAGES as readonly string[]).includes(sp.stage ?? "")
    ? (sp.stage as Stage)
    : "group";
  const groupCode = stage === "group" ? (sp.group ?? "A") : undefined;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const all = await getMatchesWithPredictions(supabase, userData.user.id);
  const filtered = all.filter((m) => {
    if (m.stage !== stage) return false;
    if (stage === "group") return m.group_code === groupCode;
    return true;
  });

  const savedCount = filtered.filter((m) => m.prediction !== null).length;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Seus palpites
          </p>
          <h1 className="font-heading text-4xl tracking-tight sm:text-5xl">
            Tabela de jogos
          </h1>
          <p className="text-muted-foreground">
            Faça seu palpite em cada partida da Copa 2026.
          </p>
        </div>
        {filtered.length > 0 ? (
          <Badge variant="secondary" className="h-7 px-3 text-xs">
            {savedCount}/{filtered.length} palpites
          </Badge>
        ) : null}
      </header>

      <StageTabs current={stage} groupCode={groupCode} />

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarX className="size-10 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum jogo disponível ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <GroupSaveForm>
          <div className="grid gap-3">
            {filtered.map((m) => (
              <MatchPredictionCard key={m.id} match={m} />
            ))}
          </div>
        </GroupSaveForm>
      )}
    </main>
  );
}
