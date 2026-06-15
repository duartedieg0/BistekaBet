"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PredictionRow } from "./prediction-row";
import { NoPredictionSection } from "./no-prediction-section";
import { filterByName } from "../_lib/search-filter";
import type { MatchPredictionRow } from "../_lib/join-prediction-rows";

type Props = {
  rows: MatchPredictionRow[];
  showPoints: boolean;
};

export function PredictionsList({ rows, showPoints }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => filterByName(rows, query), [rows, query]);
  const withPrediction = filtered.filter((r) => r.prediction !== null);
  const withoutPrediction = filtered.filter((r) => r.prediction === null);

  const noResults = query.trim() !== "" && filtered.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 -mx-6 bg-background px-6 py-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome…"
            aria-label="Buscar usuário por nome"
            className="pl-9"
          />
        </div>
      </div>

      {noResults ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum usuário encontrado.
        </p>
      ) : (
        <>
          {withPrediction.length > 0 ? (
            <div className="rounded-md border">
              <div className="flex items-center gap-3 border-b bg-muted/50 px-2 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <span className="w-8 text-right">#</span>
                <span className="size-7 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">Participante</span>
                <span className="w-16 text-right">Palpite</span>
                {showPoints ? <span className="w-12 text-right">Pts</span> : null}
              </div>
              <ul>
                {withPrediction.map((row) => (
                  <PredictionRow key={row.user_id} row={row} showPoints={showPoints} />
                ))}
              </ul>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Ninguém palpitou neste jogo.
            </p>
          )}

          <NoPredictionSection rows={withoutPrediction} />
        </>
      )}
    </div>
  );
}
