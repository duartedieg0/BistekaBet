import "server-only";
import { createClient } from "@/lib/supabase/server";
import { finalDecidedFromRow } from "./final-status-core";

/**
 * true quando a partida `stage='final'` já tem vencedor.
 * Fail-safe: qualquer erro (inclusive múltiplas linhas 'final', que fazem o
 * .maybeSingle() popular `error`) → false, ou seja, NÃO redireciona.
 * "Múltiplas finais → sem redirect" é degradação intencional: sinaliza problema
 * de dado. NÃO mascarar com `.limit(1)`.
 */
export async function isFinalDecided(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("matches")
      .select("winner_team_id")
      .eq("stage", "final")
      .maybeSingle<{ winner_team_id: string | null }>();
    if (error) return false;
    return finalDecidedFromRow(data);
  } catch {
    return false;
  }
}
