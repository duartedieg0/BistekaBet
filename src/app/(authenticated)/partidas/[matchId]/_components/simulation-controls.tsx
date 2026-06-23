"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  homeName: string;
  awayName: string;
  active: boolean;
  onApply: (result: { home: number; away: number }) => void;
  onClear: () => void;
};

function parseScore(value: string): number | null {
  const v = value.trim();
  if (!/^\d{1,2}$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n <= 99 ? n : null;
}

export function SimulationControls({ homeName, awayName, active, onApply, onClear }: Props) {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");

  const homeVal = parseScore(home);
  const awayVal = parseScore(away);
  const valid = homeVal !== null && awayVal !== null;

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Simular resultado
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="sim-home" className="text-xs">
            {homeName}
          </Label>
          <Input
            id="sim-home"
            inputMode="numeric"
            value={home}
            onChange={(e) => setHome(e.target.value)}
            className="w-16 text-center"
            aria-label={`Placar simulado de ${homeName}`}
          />
        </div>

        <span className="pb-2 text-muted-foreground" aria-hidden>
          ×
        </span>

        <div className="flex flex-col gap-1">
          <Label htmlFor="sim-away" className="text-xs">
            {awayName}
          </Label>
          <Input
            id="sim-away"
            inputMode="numeric"
            value={away}
            onChange={(e) => setAway(e.target.value)}
            className="w-16 text-center"
            aria-label={`Placar simulado de ${awayName}`}
          />
        </div>

        <Button
          type="button"
          disabled={!valid}
          onClick={() => {
            if (homeVal !== null && awayVal !== null) onApply({ home: homeVal, away: awayVal });
          }}
        >
          Simular
        </Button>

        {active ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setHome("");
              setAway("");
              onClear();
            }}
          >
            Limpar
          </Button>
        ) : null}
      </div>

      {active ? (
        <p className="text-xs text-muted-foreground">
          Resultado hipotético — não altera dados oficiais.
        </p>
      ) : null}
    </div>
  );
}
