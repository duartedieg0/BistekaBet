import { ArrowUp, Crosshair, Star, Target, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDayDdMm } from "@/lib/dates/sao-paulo-day";
import type { RetroJourney } from "@/lib/scoring/retro-core";
import type { TimelinePoint } from "@/lib/scoring/raio-x-core";
import { RetroRankSparkline } from "./retro-rank-sparkline";

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
        <span className="font-heading text-3xl tabular-nums leading-none">
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

export function RetroJourney({
  journey: j,
  timeline,
}: {
  journey: RetroJourney;
  timeline: TimelinePoint[];
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-3xl uppercase tracking-tight sm:text-4xl">
          Sua jornada
        </h2>
        <p className="text-muted-foreground">
          Como você foi ao longo dos 39 dias.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          icon={<Trophy className="size-4 text-primary" aria-hidden />}
          value={`#${j.currentRank}`}
          label={`Posição final (de ${j.totalPlayers})`}
        />
        <Stat
          icon={<Crosshair className="size-4 text-primary" aria-hidden />}
          value={String(j.totalPoints)}
          label="Total de pontos"
        />
        <Stat
          icon={<Star className="size-4 text-primary" aria-hidden />}
          value={`#${j.bestRank}`}
          label={j.bestRankDay ? `Melhor posição · ${formatDayDdMm(j.bestRankDay)}` : "Melhor posição"}
        />
        <Stat
          icon={<ArrowUp className="size-4 text-emerald-600" aria-hidden />}
          value={j.biggestClimbDay ? `+${j.biggestClimb}` : "—"}
          label={j.biggestClimbDay ? `Maior subida · ${formatDayDdMm(j.biggestClimbDay)}` : "Maior subida"}
        />
        <Stat
          icon={<Target className="size-4 text-primary" aria-hidden />}
          value={String(j.exactsTotal)}
          label="Na mosca"
        />
      </div>

      <RetroRankSparkline timeline={timeline} />
    </section>
  );
}
