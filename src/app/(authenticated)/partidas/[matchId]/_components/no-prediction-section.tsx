import { PredictionRow } from "./prediction-row";
import type { MatchPredictionRow } from "../_lib/join-prediction-rows";

export function NoPredictionSection({ rows }: { rows: MatchPredictionRow[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="rounded-md border bg-muted/30">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-muted-foreground">
        Sem palpite ({rows.length})
      </summary>
      <ul className="px-1 pb-2">
        {rows.map((row) => (
          <PredictionRow key={row.user_id} row={row} showPoints={false} />
        ))}
      </ul>
    </details>
  );
}
