"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  savePredictionSchema,
  savePredictionsBatchSchema,
  type SavePredictionInput,
} from "@/lib/validation/prediction";

type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

type BatchResult =
  | { ok: true }
  | { ok: false; errors: Array<{ matchId: string; error: string }> };

async function validateAgainstMatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  inputs: SavePredictionInput[],
): Promise<{ ok: true } | { ok: false; errors: Array<{ matchId: string; error: string }> }> {
  const ids = [...new Set(inputs.map((i) => i.matchId))];
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id,stage,kickoff_at")
    .in("id", ids);
  if (error) return { ok: false, errors: [{ matchId: "*", error: error.message }] };

  const { data: nowIso, error: nowErr } = await supabase.rpc("server_now");
  const now = nowIso ? new Date(nowIso as string).getTime() : NaN;
  if (nowErr || !Number.isFinite(now)) {
    return {
      ok: false,
      errors: [{ matchId: "*", error: "Não foi possível validar o horário do jogo. Tente de novo." }],
    };
  }

  const byId = new Map(matches?.map((m) => [m.id, m]) ?? []);
  const errs: Array<{ matchId: string; error: string }> = [];

  for (const input of inputs) {
    const m = byId.get(input.matchId);
    if (!m) {
      errs.push({ matchId: input.matchId, error: "Jogo não encontrado." });
      continue;
    }
    if (new Date(m.kickoff_at).getTime() <= now) {
      errs.push({ matchId: input.matchId, error: "Esse jogo já começou." });
      continue;
    }
    const isKnockout = m.stage !== "group";
    const isDraw = input.homeScore === input.awayScore;
    if (isKnockout && isDraw) {
      if (!input.advancesTeamId && !input.advancesSlot) {
        errs.push({ matchId: input.matchId, error: "Empate em mata-mata exige escolher quem se classifica." });
      }
    }
    if (!isKnockout) {
      input.advancesTeamId = null;
      input.advancesSlot = null;
    }
  }

  return errs.length === 0 ? { ok: true } : { ok: false, errors: errs };
}

export async function savePrediction(input: SavePredictionInput): Promise<ActionResult> {
  const parsed = savePredictionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return { ok: false, error: "Não autenticado." };

  const validation = await validateAgainstMatches(supabase, [parsed.data]);
  if (!validation.ok) return { ok: false, error: validation.errors[0].error };

  const { error } = await supabase
    .from("predictions")
    .upsert(
      {
        user_id: userData.user.id,
        match_id: parsed.data.matchId,
        home_score: parsed.data.homeScore,
        away_score: parsed.data.awayScore,
        advances_team_id: parsed.data.advancesTeamId,
        advances_slot: parsed.data.advancesSlot,
      },
      { onConflict: "user_id,match_id" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/palpites");
  return { ok: true };
}

export async function savePredictionsBatch(
  inputs: SavePredictionInput[],
): Promise<BatchResult> {
  const parsed = savePredictionsBatchSchema.safeParse(inputs);
  if (!parsed.success) {
    return {
      ok: false,
      errors: [{ matchId: "*", error: parsed.error.issues.map((i) => i.message).join("; ") }],
    };
  }

  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, errors: [{ matchId: "*", error: "Não autenticado." }] };
  }

  const validation = await validateAgainstMatches(supabase, parsed.data);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const rows = parsed.data.map((p) => ({
    user_id: userData.user!.id,
    match_id: p.matchId,
    home_score: p.homeScore,
    away_score: p.awayScore,
    advances_team_id: p.advancesTeamId,
    advances_slot: p.advancesSlot,
  }));

  const { error } = await supabase
    .from("predictions")
    .upsert(rows, { onConflict: "user_id,match_id" });
  if (error) return { ok: false, errors: [{ matchId: "*", error: error.message }] };

  revalidatePath("/palpites");
  return { ok: true };
}
