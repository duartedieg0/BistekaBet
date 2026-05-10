"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeWhatsapp } from "@/lib/whatsapp/normalize";

export type SaveWhatsappResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "duplicate" | "unauthenticated" | "unknown" };

export async function saveWhatsapp(
  _prevState: SaveWhatsappResult | null,
  formData: FormData,
): Promise<SaveWhatsappResult> {
  const raw = String(formData.get("whatsapp") ?? "");
  const result = normalizeWhatsapp(raw);
  if (!result.ok) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ whatsapp: result.e164 })
    .eq("id", user.id)
    .is("whatsapp", null);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "duplicate" };
    if (error.code === "23514") return { ok: false, error: "invalid" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
