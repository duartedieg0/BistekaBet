import { VariationArrow } from "@/components/variation-arrow";
import { getInitials } from "@/app/(authenticated)/_components/avatar-fallback";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { SimulatedRow } from "@/lib/scoring/simulate";
import type { MatchPredictionRow } from "../_lib/join-prediction-rows";

type Props = {
  row: MatchPredictionRow;
  showPoints: boolean;
  sim?: SimulatedRow | null;
};

export function PredictionRow({ row, showPoints, sim = null }: Props) {
  const hasPrediction = row.prediction !== null;
  const rank = sim ? sim.rank : row.rank;
  const showPts = showPoints || sim !== null;

  return (
    <li className="flex items-center gap-2 border-b px-2 py-2 last:border-b-0">
      <span className="flex w-12 items-center justify-end gap-0.5 font-semibold tabular-nums text-muted-foreground">
        {sim ? <VariationArrow delta={sim.delta} /> : null}
        <span>{rank}</span>
      </span>

      <Avatar className="size-7 shrink-0">
        {row.avatar_url ? <AvatarImage src={row.avatar_url} alt="" /> : null}
        <AvatarFallback className="text-xs">{getInitials(row.display_name)}</AvatarFallback>
      </Avatar>

      <span className="min-w-0 flex-1 truncate text-sm" title={row.display_name}>
        {row.display_name}
      </span>

      <span
        className={cn(
          "w-16 text-right tabular-nums font-medium",
          !hasPrediction && "text-muted-foreground italic",
        )}
      >
        {hasPrediction
          ? `${row.prediction!.home_score} × ${row.prediction!.away_score}`
          : "—"}
      </span>

      {showPts ? (
        <span
          className="w-10 text-right tabular-nums text-sm"
          aria-label={
            sim
              ? sim.points === null
                ? "sem pontos nesta partida"
                : `${sim.points} pontos`
              : `${row.score?.points ?? 0} pontos`
          }
        >
          {sim ? (sim.points ?? "—") : (row.score?.points ?? 0)}
        </span>
      ) : null}

      <span
        className="w-12 text-right tabular-nums text-sm font-semibold"
        aria-label={`total ${sim ? sim.total : row.entry.total_points} pontos`}
      >
        {sim ? sim.total : row.entry.total_points}
      </span>
    </li>
  );
}
