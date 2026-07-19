// src/lib/scoring/collective.ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type CollectiveCounts = {
  players: number;
  predictions: number;
  exacts: number;
};

/**
 * Contagens coletivas globais (jogadores, palpites, placares cravados). Via
 * service-role: são agregados não sensíveis e o mesmo valor serve tanto à home
 * pública (anônima) quanto ao /retrospectiva (autenticado). O número de "dias"
 * NÃO vem daqui — cada chamador calcula conforme o contexto.
 */
export async function loadCollectiveStats(): Promise<CollectiveCounts> {
  const supabase = createAdminClient();
  const [players, predictions, exacts] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("predictions").select("id", { count: "exact", head: true }),
    supabase
      .from("prediction_scores")
      .select("prediction_id", { count: "exact", head: true })
      .eq("tier", "exact"),
  ]);

  return {
    players: players.count ?? 0,
    predictions: predictions.count ?? 0,
    exacts: exacts.count ?? 0,
  };
}
