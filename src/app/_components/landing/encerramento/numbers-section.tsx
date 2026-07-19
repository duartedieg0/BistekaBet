// src/app/_components/landing/encerramento/numbers-section.tsx
import { COMPETITION } from "@/lib/bolao-config";
import { CountUp } from "./count-up";

type Props = {
  players: number;
  predictions: number;
  exacts: number;
  days: number;
};

export function NumbersSection({ players, predictions, exacts, days }: Props) {
  const stats = [
    { label: "Jogadores", value: players },
    { label: "Palpites", value: predictions },
    { label: "Placares cravados", value: exacts },
    { label: "Dias de bolão", value: days },
    { label: "Jogos", value: COMPETITION.totalMatches },
  ];

  return (
    <section className="relative isolate overflow-hidden bg-[oklch(0.14_0.01_30)] py-20 text-[oklch(0.97_0.01_60)] sm:py-28">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,oklch(0.85_0.18_85/0.12),transparent_70%)]"
      />
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.28em] text-[oklch(0.85_0.18_85)]">
          A Copa em números
        </p>
        <h2 className="mb-12 text-center font-heading text-4xl uppercase tracking-tight sm:text-5xl">
          O que essa galera aprontou
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center backdrop-blur-sm"
            >
              <dd className="font-heading text-4xl tabular-nums text-white sm:text-5xl">
                <CountUp value={s.value} />
              </dd>
              <dt className="text-xs uppercase tracking-widest text-white/50">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
