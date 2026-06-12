import Image from "next/image";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { STAGES, type Stage } from "@/lib/types/match";
import { StageTabs } from "./_components/stage-tabs";
import { MatchPredictionCard } from "./_components/match-prediction-card";
import { GroupSaveForm } from "./_components/group-save-form";
import { ViewToggle } from "./_components/view-toggle";
import { DateNav } from "./_components/date-nav";
import { getMatchesWithPredictions } from "./_lib/queries";
import {
  bucketMatchesByDate,
  filterMatchesByDate,
  todayInSaoPaulo,
} from "./_lib/date-buckets";

type View = "date" | "table";

export default async function PalpitesPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    date?: string;
    stage?: string;
    group?: string;
  }>;
}) {
  const sp = await searchParams;

  const view: View =
    sp.view === "date" || (!sp.view && !sp.stage) ? "date" : "table";

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const all = await getMatchesWithPredictions(supabase, userData.user.id);

  const today = todayInSaoPaulo();
  let filtered: typeof all;
  let dateBuckets: Array<{ date: string; count: number }> = [];
  let selectedDate = today;
  let stage: Stage = "group";
  let groupCode: string | undefined;

  if (view === "date") {
    dateBuckets = bucketMatchesByDate(all);
    selectedDate = sp.date ?? today;
    filtered = filterMatchesByDate(all, selectedDate).sort((a, b) =>
      a.kickoff_at.localeCompare(b.kickoff_at),
    );
  } else {
    stage = (STAGES as readonly string[]).includes(sp.stage ?? "")
      ? (sp.stage as Stage)
      : "group";
    groupCode = stage === "group" ? (sp.group ?? "A") : undefined;
    filtered = all.filter((m) => {
      if (m.stage !== stage) return false;
      if (stage === "group") return m.group_code === groupCode;
      return true;
    });
  }

  const savedCount = filtered.filter((m) => m.prediction !== null).length;
  const totalPts = filtered.reduce(
    (acc, m) => acc + (m.score?.points ?? 0),
    0,
  );

  const noMatchesAtAll = all.length === 0;
  const noMatchesForDate = view === "date" && !noMatchesAtAll && filtered.length === 0;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Seus palpites
          </p>
          <ViewToggle active={view} defaultDate={today} />
          <p className="text-muted-foreground">Faça seus palpites.</p>
        </div>
        {filtered.length > 0 ? (
          <Badge variant="secondary" className="h-7 px-3 text-xs">
            {savedCount}/{filtered.length} palpites · {totalPts} pts
          </Badge>
        ) : null}
      </header>

      {view === "date" ? (
        <DateNav buckets={dateBuckets} active={selectedDate} />
      ) : (
        <StageTabs current={stage} groupCode={groupCode} />
      )}

      {noMatchesAtAll ? (
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
      ) : noMatchesForDate ? (
        <Card className="border-2 border-foreground/10">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <p className="font-heading text-2xl uppercase tracking-wide">
              Nenhum jogo neste dia
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Escolha outra data acima.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-2 border-foreground/10">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <p className="font-heading text-2xl uppercase tracking-wide">
              Nenhum jogo nesta fase
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
