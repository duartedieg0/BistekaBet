/**
 * A final está decidida quando a partida `stage='final'` tem vencedor.
 * `winner_team_id` é o marcador definitivo (cobre prorrogação/pênaltis).
 */
export function finalDecidedFromRow(
  row: { winner_team_id: string | null } | null,
): boolean {
  return row?.winner_team_id != null;
}
