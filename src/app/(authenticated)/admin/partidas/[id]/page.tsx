import { notFound } from "next/navigation";
import { AdminShell } from "@/app/(authenticated)/admin/_components/admin-shell";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABELS, type Match, type Team } from "@/lib/types/match";
import { MatchForm } from "../_components/match-form";

export default async function EditMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [matchRes, teamsRes] = await Promise.all([
    supabase.from("matches").select("*").eq("id", id).maybeSingle(),
    supabase.from("teams").select("*").order("name", { ascending: true }),
  ]);

  if (matchRes.error) throw matchRes.error;
  if (teamsRes.error) throw teamsRes.error;
  if (!matchRes.data) notFound();

  const match = matchRes.data as Match;
  const teams = (teamsRes.data ?? []) as Team[];

  return (
    <AdminShell
      active="/admin/partidas"
      breadcrumbs={[
        { label: "Partidas", href: "/admin/partidas" },
        { label: STAGE_LABELS[match.stage] },
        { label: "Editar" },
      ]}
    >
      <h1 className="font-heading text-2xl mb-6">Editar partida</h1>
      <MatchForm match={match} teams={teams} />
    </AdminShell>
  );
}
