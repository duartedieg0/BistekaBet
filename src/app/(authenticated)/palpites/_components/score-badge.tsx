import { Badge } from "@/components/ui/badge";
import type { Prediction, PredictionScore } from "@/lib/types/prediction";

export type BadgeKind =
  | "no_prediction"
  | "awaiting"
  | "exact"
  | "winner_or_draw"
  | "miss";

export function pickBadgeKind(
  score: PredictionScore | null,
  prediction: Prediction | null,
): BadgeKind {
  if (prediction === null) return "no_prediction";
  if (score === null) return "awaiting";
  return score.tier;
}

export function ScoreBadge({
  score,
  prediction,
}: {
  score: PredictionScore | null;
  prediction: Prediction | null;
}) {
  const kind = pickBadgeKind(score, prediction);
  switch (kind) {
    case "exact":
      return (
        <Badge variant="upcoming">+{score!.points} · Placar exato</Badge>
      );
    case "winner_or_draw":
      return <Badge variant="secondary">+{score!.points} · Acertou</Badge>;
    case "miss":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          0 · Errou
        </Badge>
      );
    case "awaiting":
      return <Badge variant="outline">Aguardando</Badge>;
    case "no_prediction":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          0 · Não palpitou
        </Badge>
      );
  }
}
