"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeMatchScores } from "@/lib/scoring/recompute";
import { fetchFixtures } from "@/lib/api-football/client";
import { mapFixtureToPatch } from "@/lib/api-football/mapper";
import { buildDiffEntry, type DbMatchSlim } from "@/lib/api-football/diff";
import type { DiffEntry } from "@/lib/api-football/types";
import { setAppSetting } from "@/lib/app-settings";

export async function recomputeAllScores(): Promise<{
  matchesProcessed: number;
  upserted: number;
  deleted: number;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin", {
    uid: user.id,
  });
  if (rpcError) throw rpcError;
  if (!isAdmin) throw new Error("forbidden");

  const admin = createAdminClient();
  const { data: matches, error } = await admin.from("matches").select("id");
  if (error) throw error;

  let upserted = 0;
  let deleted = 0;
  for (const m of matches ?? []) {
    const r = await recomputeMatchScores(m.id as string);
    upserted += r.upserted;
    deleted += r.deleted;
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/inicio");
  revalidatePath("/classificacao");
  revalidatePath("/palpites");
  return { matchesProcessed: matches?.length ?? 0, upserted, deleted };
}

export type PreviewImportResult =
  | { ok: true; entries: DiffEntry[]; skipped: number }
  | { ok: false; error: string };

const FINISHED_OR_OFFFIELD = new Set(["FT", "AET", "PEN", "PST", "CANC"]);

export async function previewImport(): Promise<PreviewImportResult> {
  try {
    // Auth + admin (mirror the existing pattern in this file)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "unauthenticated" };
    const { data: isAdmin } = await supabase.rpc("is_admin", { uid: user.id });
    if (!isAdmin) return { ok: false, error: "forbidden" };

    // Load mapped matches (with team names for label)
    const admin = createAdminClient();
    const { data: matches, error: mErr } = await admin
      .from("matches")
      .select(`
        id, api_football_id,
        home_team_id, away_team_id,
        home_score, away_score,
        home_score_et, away_score_et,
        home_pens, away_pens,
        winner_team_id, status,
        home_team:home_team_id(name, api_football_id),
        away_team:away_team_id(name, api_football_id)
      `)
      .not("api_football_id", "is", null);
    if (mErr) throw mErr;

    // Supabase types relations as arrays por padrao; normalizamos para single-object via cast.
    type MatchRow = NonNullable<typeof matches>[number] & {
      home_team: { name: string; api_football_id: number | null } | null;
      away_team: { name: string; api_football_id: number | null } | null;
    };
    const rows = (matches ?? []) as unknown as MatchRow[];
    const byApiId = new Map<number, MatchRow>();
    for (const m of rows) byApiId.set(m.api_football_id as number, m);

    const fixtures = await fetchFixtures();
    const entries: DiffEntry[] = [];
    let skipped = 0;

    for (const fx of fixtures) {
      if (!FINISHED_OR_OFFFIELD.has(fx.fixture.status.short)) { skipped++; continue; }
      const m = byApiId.get(fx.fixture.id);
      if (!m || !m.home_team_id || !m.away_team_id) { skipped++; continue; }

      const patch = mapFixtureToPatch(fx, m.home_team_id, m.away_team_id);
      const db: DbMatchSlim = {
        id: m.id,
        api_football_id: m.api_football_id,
        home_team_name: m.home_team?.name ?? "?",
        away_team_name: m.away_team?.name ?? "?",
        home_score: m.home_score, away_score: m.away_score,
        home_score_et: m.home_score_et, away_score_et: m.away_score_et,
        home_pens: m.home_pens, away_pens: m.away_pens,
        winner_team_id: m.winner_team_id,
        status: m.status as DbMatchSlim["status"],
      };
      const entry = buildDiffEntry(db, patch);
      if (entry) entries.push(entry);
    }

    return { ok: true, entries, skipped };
  } catch (err) {
    console.error("previewImport failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export type CommitImportResult =
  | { ok: true; updated: number; unchanged: number; errored: number }
  | { ok: false; error: string };

const RATE_LIMIT_MS = 30_000;

export async function commitImport(entries: DiffEntry[]): Promise<CommitImportResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "unauthenticated" };
    const { data: isAdmin } = await supabase.rpc("is_admin", { uid: user.id });
    if (!isAdmin) return { ok: false, error: "forbidden" };

    const admin = createAdminClient();

    // Rate-limit (commits only)
    const { data: lastRun } = await admin
      .from("import_runs")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRun) {
      const age = Date.now() - new Date(lastRun.created_at).getTime();
      if (age < RATE_LIMIT_MS) {
        return { ok: false, error: `aguarde ${Math.ceil((RATE_LIMIT_MS - age) / 1000)}s antes do proximo import` };
      }
    }

    let updated = 0, errored = 0;
    const recomputeIds: string[] = [];

    for (const entry of entries) {
      const patch: Record<string, unknown> = {};
      for (const c of entry.changes) patch[c.field] = c.to;
      const { error: uErr } = await admin
        .from("matches")
        .update(patch)
        .eq("id", entry.matchId);
      if (uErr) { errored++; continue; }
      updated++;
      if (entry.willRecompute) recomputeIds.push(entry.matchId);
    }

    const { error: logErr } = await admin.from("import_runs").insert({
      admin_id: user.id,
      source: "api-football",
      matches_updated: updated,
      matches_unchanged: 0,
      matches_errored: errored,
      diff: entries,
    });
    if (logErr) console.error("import_runs insert failed", logErr);

    // Recompute scores per affected match (idempotent)
    for (const id of recomputeIds) {
      try { await recomputeMatchScores(id); }
      catch (e) { console.error("recompute failed for", id, e); }
    }

    revalidatePath("/admin");
    revalidatePath("/admin/partidas");
    revalidatePath("/");
    revalidatePath("/inicio");
    revalidatePath("/classificacao");
    revalidatePath("/palpites");

    return { ok: true, updated, unchanged: 0, errored };
  } catch (err) {
    console.error("commitImport failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function setCopaEncerrada(
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "unauthenticated" };

    const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin", {
      uid: user.id,
    });
    if (rpcError) return { ok: false, error: rpcError.message };
    if (!isAdmin) return { ok: false, error: "forbidden" };

    await setAppSetting<boolean>("copa_encerrada", enabled);

    revalidatePath("/");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

export async function setEventInviteEnabled(
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "unauthenticated" };

    const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin", {
      uid: user.id,
    });
    if (rpcError) return { ok: false, error: rpcError.message };
    if (!isAdmin) return { ok: false, error: "forbidden" };

    await setAppSetting<boolean>("event_invite_enabled", enabled);

    revalidatePath("/");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
