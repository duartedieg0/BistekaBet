import { ArrowUp, Crosshair, Star, Target, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDayDdMm } from "@/lib/dates/sao-paulo-day";
import type { RaioXHighlights } from "@/lib/scoring/raio-x-core";

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="font-heading text-3xl tabular-nums leading-none">{value}</span>
      </CardContent>
    </Card>
  );
}

export function HighlightCards({ highlights: h }: { highlights: RaioXHighlights }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat
        icon={<Trophy className="size-4 text-primary" aria-hidden />}
        value={`#${h.currentRank}`}
        label={`Posição atual (de ${h.totalPlayers})`}
      />
      <Stat
        icon={<Star className="size-4 text-primary" aria-hidden />}
        value={`#${h.bestRank}`}
        label={`Melhor posição · ${formatDayDdMm(h.bestRankDay)}`}
      />
      <Stat
        icon={<ArrowUp className="size-4 text-emerald-600" aria-hidden />}
        value={h.biggestClimbDay ? `+${h.biggestClimb}` : "—"}
        label={h.biggestClimbDay ? `Maior subida · ${formatDayDdMm(h.biggestClimbDay)}` : "Maior subida"}
      />
      <Stat
        icon={<Crosshair className="size-4 text-primary" aria-hidden />}
        value={String(h.totalPoints)}
        label="Total de pontos"
      />
      <Stat
        icon={<Target className="size-4 text-primary" aria-hidden />}
        value={String(h.exactsTotal)}
        label="Na mosca"
      />
    </div>
  );
}
