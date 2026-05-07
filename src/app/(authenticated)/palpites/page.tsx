import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAGES, type Stage } from "@/lib/types/match";
import { StageTabs } from "./_components/stage-tabs";
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

  return (
    <>
      <h1 className="font-heading text-2xl mb-6">Palpites</h1>
      <StageTabs current={stage} groupCode={groupCode} />
      {filtered.length === 0 ? (
        <p className="text-muted-foreground">Nenhum jogo disponível ainda.</p>
      ) : (
        <pre className="text-xs bg-muted p-3 rounded">
          {JSON.stringify(filtered.map((m) => ({ id: m.id, hp: m.home_team?.code, ap: m.away_team?.code, k: m.kickoff_at, p: m.prediction })), null, 2)}
        </pre>
      )}
    </>
  );
}
