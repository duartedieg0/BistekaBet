import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Match, Team } from "@/lib/types/match";
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
    <>
      <h1 className="font-heading text-2xl mb-6">Editar partida</h1>
      <MatchForm match={match} teams={teams} />
    </>
  );
}
