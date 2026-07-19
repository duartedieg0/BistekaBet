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

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Igual a getAppSetting, mas via service-role. Necessário para leitura em
 * contexto anônimo (home pública), onde o RLS de `app_settings` (só
 * `authenticated`) devolveria sempre o fallback. Degrada para o fallback se o
 * client admin não puder ser criado (env ausente) ou a query falhar.
 */
export async function getAppSettingAdmin<T>(key: string, fallback: T): Promise<T> {
  try {
    const supabase = createAdminClient();
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
