"use client";

import { useSyncExternalStore } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDayDdMm } from "@/lib/dates/sao-paulo-day";
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

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TimelinePoint }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <div className="font-semibold">{formatDayDdMm(p.day)}</div>
      <div>Posição: #{p.rank}</div>
      <div>Pontos no dia: {p.pointsThatDay}</div>
      <div>Total: {p.cumulativePoints}</div>
      {p.delta !== 0 && (
        <div className={p.delta > 0 ? "text-emerald-600" : "text-red-600"}>
          {p.delta > 0 ? `↑ ${p.delta}` : `↓ ${-p.delta}`} posições
        </div>
      )}
    </div>
  );
}

export function RankTimelineChart({ timeline }: { timeline: TimelinePoint[] }) {
  const mounted = useHydrated();

  const ranks = timeline.map((t) => t.rank);
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);
  const domain: [number, number] = [Math.max(1, minRank - 1), maxRank + 1];

  return (
    <div
      className="h-[300px] w-full"
      role="img"
      aria-label="Gráfico da sua posição ao longo da Copa (a tabela abaixo traz os mesmos dados)"
    >
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeline} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={formatDayDdMm}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              minTickGap={16}
              tickMargin={8}
            />
            <YAxis
              reversed
              domain={domain}
              allowDecimals={false}
              width={32}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="linear"
              dataKey="rank"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
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
