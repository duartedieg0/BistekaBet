import { Trophy, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { GoogleSignInButton } from "../google-sign-in-button";

export function Hero({ errorMessage }: { errorMessage?: string | null }) {
  return (
    <section className="relative isolate overflow-hidden bg-[oklch(0.16_0.02_150)] text-[oklch(0.97_0.01_145)]">
      <BackgroundDecor />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 pt-24 pb-28 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:pt-32 lg:pb-36">
        <div className="flex flex-col items-start gap-7 text-left">
          <Badge
            variant="outline"
            className="border-white/20 bg-white/5 text-xs uppercase tracking-widest text-[oklch(0.92_0.20_120)] backdrop-blur"
          >
            <Zap className="size-3" /> Copa 2026 · 11 jun → 19 jul
          </Badge>

          <h1 className="font-heading text-5xl leading-[0.95] tracking-tight sm:text-6xl md:text-7xl lg:text-[5.5rem]">
            Seu palpite{" "}
            <span className="text-[oklch(0.92_0.20_120)]">vale taça.</span>
          </h1>

          <p className="max-w-xl text-lg text-white/70 sm:text-xl">
            Entre no bolão com seus amigos, palpite todos os 104 jogos da Copa
            do Mundo de 2026 e acompanhe o ranking ao vivo a cada apito final.
          </p>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <GoogleSignInButton size="lg" variant="accent" />
            <a
              href="#como-funciona"
              className={
                buttonVariants({ variant: "outline", size: "lg" }) +
                " border-white/20 bg-white/5 text-white hover:bg-white/10"
              }
            >
              Como funciona
            </a>
          </div>

          <dl className="flex items-center gap-8 pt-4 text-sm text-white/60">
            <div className="flex flex-col">
              <dt className="text-xs uppercase tracking-widest text-white/40">
                Jogos
              </dt>
              <dd className="font-heading text-3xl text-white tabular">104</dd>
            </div>
            <div className="h-10 w-px bg-white/10" aria-hidden />
            <div className="flex flex-col">
              <dt className="text-xs uppercase tracking-widest text-white/40">
                Países
              </dt>
              <dd className="font-heading text-3xl text-white tabular">48</dd>
            </div>
            <div className="h-10 w-px bg-white/10" aria-hidden />
            <div className="flex flex-col">
              <dt className="text-xs uppercase tracking-widest text-white/40">
                Custo
              </dt>
              <dd className="font-heading text-3xl text-white">Grátis</dd>
            </div>
          </dl>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-[oklch(0.85_0.18_27)]"
            >
              {errorMessage}
            </p>
          )}
        </div>

        <Scoreboard />
      </div>
    </section>
  );
}

function BackgroundDecor() {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.62_0.17_145/0.45),transparent_60%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_30%_at_85%_30%,oklch(0.92_0.20_120/0.18),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,transparent,oklch(0.16_0.02_150))] [mask-image:linear-gradient(to_bottom,transparent,black_60%)]"
      />
    </>
  );
}

function Scoreboard() {
  return (
    <div className="relative w-full max-w-md justify-self-center lg:max-w-none lg:justify-self-end">
      <div
        aria-hidden
        className="absolute -inset-2 -z-10 rounded-3xl bg-gradient-to-br from-[oklch(0.92_0.20_120/0.25)] to-transparent blur-xl"
      />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm shadow-[0_0_60px_-20px_oklch(0.92_0.20_120/0.4)]">
        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/40">
          <span>Final · MetLife Stadium</span>
          <span className="inline-flex items-center gap-1.5 text-[oklch(0.92_0.20_120)]">
            <span className="size-1.5 rounded-full bg-[oklch(0.92_0.20_120)] animate-pulse" />
            Ao vivo
          </span>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Team flag="🇧🇷" code="BRA" name="Brasil" />
          <div className="flex flex-col items-center gap-1">
            <div className="font-heading text-6xl tracking-tight text-white tabular">
              2 <span className="text-white/30">·</span> 1
            </div>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/50">
              90+3'
            </span>
          </div>
          <Team flag="🇦🇷" code="ARG" name="Argentina" align="right" />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-xs">
          <Stat label="Seu palpite" value="2 × 1" hit />
          <Stat label="Pontos" value="+25" />
          <Stat label="Rank" value="#3" />
        </div>
      </div>

      <div
        aria-hidden
        className="absolute -bottom-6 left-1/2 -z-10 h-12 w-2/3 -translate-x-1/2 rounded-full bg-[oklch(0.92_0.20_120/0.25)] blur-2xl"
      />
    </div>
  );
}

function Team({
  flag,
  code,
  name,
  align = "left",
}: {
  flag: string;
  code: string;
  name: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex flex-col gap-1 ${align === "right" ? "items-end text-right" : "items-start"}`}
    >
      <span className="text-3xl leading-none" aria-hidden>
        {flag}
      </span>
      <span className="font-heading text-2xl tracking-wide text-white">
        {code}
      </span>
      <span className="text-xs text-white/50">{name}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  hit,
}: {
  label: string;
  value: string;
  hit?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-white/40">
        {label}
      </span>
      <span
        className={`font-heading text-xl tabular ${
          hit ? "text-[oklch(0.92_0.20_120)]" : "text-white"
        }`}
      >
        {value}
        {hit ? (
          <Trophy className="ml-1 inline size-3 -translate-y-0.5" />
        ) : null}
      </span>
    </div>
  );
}
