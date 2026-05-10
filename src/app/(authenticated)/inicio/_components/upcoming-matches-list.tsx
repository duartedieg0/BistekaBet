import { CalendarOff } from "lucide-react";
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

  return (
    <div className="flex flex-col gap-3">
      {dayLabel ? (
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {dayLabel}
        </p>
      ) : null}
      <div className="grid gap-3">
        {matches.map((m) => (
          <MatchPredictionCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}
