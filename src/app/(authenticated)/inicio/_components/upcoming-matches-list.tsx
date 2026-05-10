import { CalendarOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MatchPredictionCard } from "@/app/(authenticated)/palpites/_components/match-prediction-card";
import type { MatchWithPrediction } from "@/lib/types/prediction";

export function UpcomingMatchesList({
  matches,
  dayLabel,
}: {
  matches: MatchWithPrediction[];
  dayLabel: string | null;
}) {
  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <CalendarOff className="size-6 opacity-60" aria-hidden />
        <p className="text-sm">Sem jogos agendados ainda.</p>
      </div>
    );
  }

  const now = Date.now();
  const openCount = matches.filter(
    (m) => new Date(m.kickoff_at).getTime() > now,
  ).length;

  return (
    <div className="flex flex-col gap-3 pb-4">
      {(dayLabel || openCount > 0) && (
        <div className="flex items-center justify-between gap-2">
          {dayLabel ? (
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {dayLabel}
            </p>
          ) : <span />}
          {openCount > 0 ? (
            <Badge variant="secondary">
              {openCount} aberto{openCount === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </div>
      )}
      <div className="grid gap-3">
        {matches.map((m) => (
          <MatchPredictionCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}
