import Image from "next/image";
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
  const totalPts = filtered.reduce(
    (acc, m) => acc + (m.score?.points ?? 0),
    0,
  );

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Seus palpites
          </p>
          <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
            Tabela de jogos
          </h1>
          <p className="text-muted-foreground">
            Faça seus palpites.
          </p>
        </div>
        {filtered.length > 0 ? (
          <Badge variant="secondary" className="h-7 px-3 text-xs">
            {savedCount}/{filtered.length} palpites · {totalPts} pts
          </Badge>
        ) : null}
      </header>

      <StageTabs current={stage} groupCode={groupCode} />

      {filtered.length === 0 ? (
        <Card className="border-2 border-foreground/10">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <Image
              src="/BISTECA.png"
              alt=""
              width={120}
              height={154}
              className="h-28 w-auto opacity-80"
            />
            <p className="font-heading text-2xl uppercase tracking-wide">
              Nenhum jogo no forno
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Os jogos aparecem aqui assim que a tabela da Copa 2026 for
              publicada. Volte logo.
            </p>
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
