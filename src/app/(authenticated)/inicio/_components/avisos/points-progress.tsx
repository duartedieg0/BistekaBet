export function PointsProgress({ earned, possible }: { earned: number; possible: number }) {
  if (possible === 0) return null;
  const percent = Math.round((earned / possible) * 100);
  return (
    <div className="flex flex-col gap-1">
      <span className="font-heading text-4xl text-primary tabular leading-none">{percent}%</span>
      <span className="text-xs text-muted-foreground">
        {earned} de {possible} pts possíveis
      </span>
    </div>
  );
}
