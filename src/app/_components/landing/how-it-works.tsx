"use client";

import { LogIn, Target, Trophy, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useGoogleSignIn } from "@/app/_components/use-google-sign-in";
import {
  COMPETITION,
  INSCRIPTION_VALUE_BRL,
  formatBRL,
} from "@/lib/bolao-config";

type Step = {
  n: string;
  icon: LucideIcon;
  title: string;
  body: string;
};

const steps: Step[] = [
  {
    n: "01",
    icon: LogIn,
    title: "Entre",
    body: `Login em 1 clique com sua conta Google e pague a inscrição de ${formatBRL(
      INSCRIPTION_VALUE_BRL,
    )} até o início da Copa.`,
  },
  {
    n: "02",
    icon: Target,
    title: "Palpite",
    body: `Palpite os ${COMPETITION.totalMatches} jogos. Editável até o horário oficial de início de cada partida`,
  },
  {
    n: "03",
    icon: Trophy,
    title: "Ganhe",
    body: "Pontuação cresce a cada fase. Tem emoção até a final.",
  },
];

export function HowItWorks() {
  const { signIn, pending } = useGoogleSignIn();

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
        </div>

        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, idx) => (
            <li key={step.n}>
              {idx === 0 ? (
                <button
                  type="button"
                  onClick={signIn}
                  disabled={pending}
                  aria-label="Entrar com a conta Google"
                  className="block h-full w-full text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
                >
                  <StepCard step={step} interactive />
                </button>
              ) : (
                <StepCard step={step} />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StepCard({
  step,
  interactive = false,
}: {
  step: Step;
  interactive?: boolean;
}) {
  const Icon = step.icon;
  return (
    <Card
      className={`group relative h-full overflow-hidden border-2 border-foreground transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-stamp ${
        interactive ? "cursor-pointer" : ""
      }`}
    >
      <CardContent className="flex h-full flex-col gap-4 p-7">
        <div className="flex items-center justify-between">
          <span className="font-heading text-5xl text-muted-foreground/30 tabular">
            {step.n}
          </span>
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="size-5" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="font-heading text-2xl tracking-wide">{step.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {step.body}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
