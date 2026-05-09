"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeMatchScores } from "@/lib/scoring/recompute";

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
  return { matchesProcessed: matches?.length ?? 0, upserted, deleted };
}
