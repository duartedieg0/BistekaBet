import { Card, CardContent } from "@/components/ui/card";
import type { Persona } from "@/lib/retro/personas";

export function RetroPersonaReveal({ persona }: { persona: Persona }) {
  return (
    <section className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Você foi
          </p>
          <span aria-hidden className="text-7xl leading-none">
            {persona.emoji}
          </span>
          <h2 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
            {persona.title}
          </h2>
          <p className="max-w-sm text-lg text-muted-foreground">
            {persona.subtitle}
          </p>
          <p className="max-w-sm rounded-lg bg-muted px-4 py-3 text-sm font-medium">
            {persona.reason}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
