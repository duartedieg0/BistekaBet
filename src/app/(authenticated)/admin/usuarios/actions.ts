"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setUserPaid(userId: string, paid: boolean): Promise<void> {
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
  const { error } = await admin
    .from("profiles")
    .update({ paid })
    .eq("id", userId);
  if (error) throw error;

  revalidatePath("/admin/usuarios");
}
