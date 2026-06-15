import { getInitials } from "@/app/(authenticated)/_components/avatar-fallback";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { MatchPredictionRow } from "../_lib/join-prediction-rows";

type Props = {
  row: MatchPredictionRow;
  showPoints: boolean;
};

export function PredictionRow({ row, showPoints }: Props) {
  const hasPrediction = row.prediction !== null;
  return (
    <li className="flex items-center gap-3 border-b px-2 py-2 last:border-b-0">
      <span className="w-8 text-right font-semibold tabular-nums text-muted-foreground">
        {row.rank}
      </span>
      <Avatar className="size-7 shrink-0">
        {row.avatar_url ? <AvatarImage src={row.avatar_url} alt="" /> : null}
        <AvatarFallback className="text-xs">
          {getInitials(row.display_name)}
        </AvatarFallback>
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
      {showPoints ? (
        <span
          className="w-12 text-right tabular-nums text-sm"
          aria-label={`${row.score?.points ?? 0} pontos`}
        >
          {row.score?.points ?? 0}
        </span>
      ) : null}
    </li>
  );
}
