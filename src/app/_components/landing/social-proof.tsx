import { Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const testimonials = [
  {
    quote:
      "Saiu da planilha do tio e foi pro BistekaBet. Em duas rodadas a galera tava grudada no ranking.",
    name: "Mariana A.",
    role: "Organizadora · 38 amigos",
  },
  {
    quote:
      "A interface do scoreboard ao vivo é melhor do que muito app de aposta de verdade. Surreal.",
    name: "Rafael C.",
    role: "Capitão do bolão da firma",
  },
  {
    quote:
      "Pontuação atualiza no apito final, sem confusão. Acabou aquela treta de quem ganhou o saideira.",
    name: "Bruno H.",
    role: "Bolão da família",
  },
  {
    quote:
      "Ganhei 3 rodadas seguidas e tenho prints. Recomendo zero, querem ganhar de mim.",
    name: "Camila P.",
    role: "Líder atual",
  },
];

export function SocialProof() {
  return (
    <section className="relative bg-secondary/40 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Já estão dentro
          </p>
          <h2 className="mt-3 font-heading text-4xl tracking-tight sm:text-5xl">
            O bolão que a galera não larga
          </h2>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {testimonials.map((t, i) => (
            <Card
              key={i}
              className="h-full border-border/60 bg-card/80 backdrop-blur-sm"
            >
              <CardContent className="flex h-full flex-col gap-5 p-6">
                <Quote className="size-5 text-primary/40" aria-hidden />
                <p className="flex-1 text-sm leading-relaxed text-foreground">
                  {t.quote}
                </p>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {t.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.role}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-muted-foreground">
          <Metric n="2.4k" label="Palpites por rodada" />
          <Dot />
          <Metric n="180+" label="Bolões ativos" />
          <Dot />
          <Metric n="48h" label="Setup médio" />
        </div>
      </div>
    </section>
  );
}

function Metric({ n, label }: { n: string; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="font-heading text-3xl text-foreground tabular">{n}</span>
      <span>{label}</span>
    </span>
  );
}

function Dot() {
  return (
    <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
  );
}
