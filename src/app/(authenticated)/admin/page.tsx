import { CalendarDays, TrendingUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RecomputeScoresCard } from "./_components/recompute-scores-card";
import { ImportResultsCard } from "./_components/import-results-card";

export default function AdminPage() {
  return (
    <>
      <header className="flex flex-col gap-1 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-destructive">
          Visão geral
        </p>
        <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
          Painel do BistekaBet
        </h1>
        <p className="text-muted-foreground">
          Operação do bolão: usuários, partidas e pagamentos.
        </p>
      </header>

      <section className="grid gap-5 sm:grid-cols-3">
        <Kpi label="Usuários ativos" value="—" icon={Users} delta="+0" />
        <Kpi label="Palpites na rodada" value="—" icon={TrendingUp} delta="—" />
        <Kpi
          label="Próximas partidas"
          value="—"
          icon={CalendarDays}
          delta="0 abertas"
        />
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <h2 className="font-heading text-2xl tracking-wide">
              Últimas partidas
            </h2>
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </CardContent>
        </Card>
        <RecomputeScoresCard />
        <ImportResultsCard />
      </section>
    </>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  delta,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  delta: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
          <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Icon className="size-4" />
          </div>
        </div>
        <span className="font-heading text-5xl tabular leading-none">
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{delta}</span>
      </CardContent>
    </Card>
  );
}
