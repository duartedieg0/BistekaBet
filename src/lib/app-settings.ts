// src/lib/app-settings.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getAppSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle<{ value: T }>();
    if (error || !data) return fallback;
    return data.value;
  } catch {
    return fallback;
  }
}

export async function setAppSetting<T>(key: string, value: T): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw error;
}
