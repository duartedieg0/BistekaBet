"use client";

import { useSyncExternalStore } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import type { TimelinePoint } from "@/lib/scoring/raio-x-core";

// Detecta hidratação sem setState-em-effect: falso no SSR, verdadeiro no cliente.
const noopSubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function RetroRankSparkline({ timeline }: { timeline: TimelinePoint[] }) {
  const mounted = useHydrated();

  if (!timeline.length) return null;

  const ranks = timeline.map((t) => t.rank);
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);
  const domain: [number, number] = [Math.max(1, minRank - 1), maxRank + 1];

  return (
    <div
      className="h-[180px] w-full"
      role="img"
      aria-label="Sparkline da sua posição ao longo da Copa"
    >
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeline} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <YAxis
              reversed
              domain={domain}
              allowDecimals={false}
              hide
            />
            <Line
              type="linear"
              dataKey="rank"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full animate-pulse rounded-lg bg-muted" />
      )}
    </div>
  );
}
