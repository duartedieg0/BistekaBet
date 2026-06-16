"use server";

import { createClient } from "@/lib/supabase/server";

export type SaveNotifyWhatsappResult =
  | { ok: true }
  | { ok: false; error: "unauthenticated" | "unknown" };

export async function saveNotifyWhatsapp(
  enabled: boolean,
): Promise<SaveNotifyWhatsappResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ notify_whatsapp: enabled })
    .eq("id", user.id);

  if (error) return { ok: false, error: "unknown" };
  return { ok: true };
}
