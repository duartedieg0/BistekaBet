import { AdminShell } from "@/app/(authenticated)/admin/_components/admin-shell";
import { createClient } from "@/lib/supabase/server";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/types/match";
import { StageTabs } from "./_components/stage-tabs";
import { MatchList, type MatchWithTeams } from "./_components/match-list";

export default async function PartidasPage({
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
  let query = supabase
    .from("matches")
    .select("*, home_team:home_team_id(id,code,name), away_team:away_team_id(id,code,name)")
    .eq("stage", stage)
    .order("kickoff_at", { ascending: true });

  if (stage === "group") {
    query = query.eq("group_code", groupCode!);
  } else {
    query = query.order("bracket_position", { ascending: true });
  }

  const { data, error } = await query;
  if (error) throw error;

  return (
    <AdminShell
      active="/admin/partidas"
      breadcrumbs={[{ label: "Partidas" }, { label: STAGE_LABELS[stage] }]}
    >
      <h1 className="font-heading text-2xl mb-6">Partidas</h1>
      <StageTabs current={stage} groupCode={groupCode} />
      <MatchList matches={(data ?? []) as MatchWithTeams[]} />
    </AdminShell>
  );
}
