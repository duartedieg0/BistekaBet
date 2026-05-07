"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { upsertTeamSchema } from "@/lib/validation/match";

export async function upsertTeam(formData: FormData) {
  const raw = {
    id: (formData.get("id") as string) || undefined,
    code: (formData.get("code") as string)?.toUpperCase(),
    name: formData.get("name") as string,
    flag_url: (formData.get("flag_url") as string) || null,
    group_code: (formData.get("group_code") as string) || null,
  };

  const parsed = upsertTeamSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const supabase = await createClient();
  if (parsed.data.id) {
    const { error } = await supabase
      .from("teams")
      .update({
        code: parsed.data.code,
        name: parsed.data.name,
        flag_url: parsed.data.flag_url,
        group_code: parsed.data.group_code,
      })
      .eq("id", parsed.data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("teams").insert({
      code: parsed.data.code,
      name: parsed.data.name,
      flag_url: parsed.data.flag_url,
      group_code: parsed.data.group_code,
    });
    if (error) throw error;
  }

  revalidatePath("/admin/times");
  redirect("/admin/times");
}
