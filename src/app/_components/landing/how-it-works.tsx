import { LogIn, Target, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    n: "01",
    icon: LogIn,
    title: "Entre",
    body: "Login em 1 clique com sua conta Google. Nada de senha, nada de cadastro chato.",
  },
  {
    n: "02",
    icon: Target,
    title: "Palpite",
    body: "Dê seu palpite para todos os jogos. Editável até o apito inicial de cada partida.",
  },
  {
    n: "03",
    icon: Trophy,
    title: "Ganhe",
    body: "Pontos a cada acerto, ranking ao vivo e a glória de fechar o pódio entre os amigos.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="relative scroll-mt-20 bg-background py-24 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Como funciona
          </p>
          <h2 className="mt-3 font-heading text-4xl tracking-tight sm:text-5xl">
            Três passos até a taça do bolão
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Sem planilha de Excel, sem mensagem perdida no grupo. Tudo num lugar
            só.
          </p>
        </div>

        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map(({ n, icon: Icon, title, body }) => (
            <li key={n}>
              <Card className="group relative h-full overflow-hidden border-2 border-foreground transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-stamp">
                <CardContent className="flex h-full flex-col gap-4 p-7">
                  <div className="flex items-center justify-between">
                    <span className="font-heading text-5xl text-muted-foreground/30 tabular">
                      {n}
                    </span>
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-5" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-heading text-2xl tracking-wide">
                      {title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
