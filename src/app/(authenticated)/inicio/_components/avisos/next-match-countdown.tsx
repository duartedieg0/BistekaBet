"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formatCountdown } from "../../_lib/format-countdown";

type Match = {
  id: string;
  homeCode: string;
  awayCode: string;
  kickoffAt: string;
};

export function NextMatchCountdown({ match }: { match: Match }) {
  const [label, setLabel] = useState<string>("--:--:--");

  useEffect(() => {
    const kickoffMs = new Date(match.kickoffAt).getTime();
    const tick = () => setLabel(formatCountdown(kickoffMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [match.kickoffAt]);

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-red-500/40 bg-red-500/10 p-3"
    >
      <Timer className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden />
      <div className="flex flex-col gap-1 text-sm">
        <span
          aria-live="polite"
          className="font-heading text-2xl text-foreground tabular-nums leading-none"
        >
          {label}
        </span>
        <span className="text-muted-foreground">
          {match.homeCode} × {match.awayCode} · você ainda não palpitou
        </span>
      </div>
    </div>
  );
}
