"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { recomputeMatchScores } from "@/lib/scoring/recompute";
import { updateMatchSchema } from "@/lib/validation/match";

function parseIntOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function updateMatch(matchId: string, formData: FormData) {
  const raw = {
    kickoff_at: formData.get("kickoff_at") as string,
    venue: (formData.get("venue") as string) || null,
    home_team_id: (formData.get("home_team_id") as string) || null,
    away_team_id: (formData.get("away_team_id") as string) || null,
    home_score: parseIntOrNull(formData.get("home_score")),
    away_score: parseIntOrNull(formData.get("away_score")),
    home_score_et: parseIntOrNull(formData.get("home_score_et")),
    away_score_et: parseIntOrNull(formData.get("away_score_et")),
    home_pens: parseIntOrNull(formData.get("home_pens")),
    away_pens: parseIntOrNull(formData.get("away_pens")),
    winner_team_id: (formData.get("winner_team_id") as string) || null,
    status: (formData.get("status") as string) || null,
  };

  const parsed = updateMatchSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("matches").update(parsed.data).eq("id", matchId);
  if (error) throw error;

  await recomputeMatchScores(matchId);

  revalidatePath("/admin/partidas");
  revalidatePath(`/admin/partidas/${matchId}`);
  redirect("/admin/partidas");
}
