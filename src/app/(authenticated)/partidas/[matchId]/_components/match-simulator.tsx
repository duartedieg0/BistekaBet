"use client";

import { useMemo, useState } from "react";
import { simulateMatchRanking } from "@/lib/scoring/simulate";
import type { Stage } from "@/lib/types/match";
import { SimulationControls } from "./simulation-controls";
import { PredictionsList } from "./predictions-list";
import type { MatchPredictionRow } from "../_lib/join-prediction-rows";

type Props = {
  rows: MatchPredictionRow[];
  stage: Stage;
  homeName: string;
  awayName: string;
};

export function MatchSimulator({ rows, stage, homeName, awayName }: Props) {
  const [result, setResult] = useState<{ home: number; away: number } | null>(null);

  const hasAnyPrediction = useMemo(
    () => rows.some((r) => r.prediction !== null),
    [rows],
  );

  const simulation = useMemo(() => {
    if (!result) return null;
    const entries = rows.map((r) => r.entry);
    const predictions = new Map(
      rows
        .filter((r) => r.prediction !== null)
        .map(
          (r) =>
            [
              r.user_id,
              { home: r.prediction!.home_score, away: r.prediction!.away_score },
            ] as const,
        ),
    );
    return simulateMatchRanking({ entries, predictions, result, stage });
  }, [result, rows, stage]);

  return (
    <div className="flex flex-col gap-4">
      {hasAnyPrediction ? (
        <SimulationControls
          homeName={homeName}
          awayName={awayName}
          active={simulation !== null}
          onApply={setResult}
          onClear={() => setResult(null)}
        />
      ) : null}
      <PredictionsList rows={rows} showPoints={false} simulation={simulation} />
    </div>
  );
}
