import { Users, Hash, Crosshair, Shield, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { CollectiveStats } from "@/lib/scoring/retro-core";

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

export function RetroCollective({ collective: c }: { collective: CollectiveStats }) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-3xl uppercase tracking-tight sm:text-4xl">
          A gente viveu isso junto
        </h2>
        <p className="text-muted-foreground">
          Números do nosso bolão ao longo da Copa.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          icon={<Users className="size-4 text-primary" aria-hidden />}
          value={String(c.players)}
          label="Amigos"
        />
        <Stat
          icon={<Hash className="size-4 text-primary" aria-hidden />}
          value={String(c.predictions)}
          label="Palpites"
        />
        <Stat
          icon={<Crosshair className="size-4 text-primary" aria-hidden />}
          value={String(c.exacts)}
          label="Na mosca (grupo)"
        />
        <Stat
          icon={<Shield className="size-4 text-primary" aria-hidden />}
          value={String(c.matches)}
          label="Jogos"
        />
        <Stat
          icon={<Calendar className="size-4 text-primary" aria-hidden />}
          value={String(c.days)}
          label="Dias"
        />
      </div>
    </section>
  );
}
