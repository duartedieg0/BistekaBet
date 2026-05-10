import Image from "next/image";
import { Trophy, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { GoogleSignInButton } from "../google-sign-in-button";
import {
  COMPETITION,
  INSCRIPTION_VALUE_BRL,
  PHASE_POINTS,
  formatBRL,
} from "@/lib/bolao-config";

const FINAL_EXACT_POINTS =
  PHASE_POINTS.find((p) => p.key === "final")?.exactScore ?? 34;

export function Hero({ errorMessage }: { errorMessage?: string | null }) {
  return (
    <section className="relative isolate overflow-hidden bg-[oklch(0.14_0.01_30)] text-[oklch(0.97_0.01_60)]">
      <BackgroundDecor />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pt-20 pb-24 lg:grid-cols-[1.15fr_1fr] lg:gap-10 lg:pt-28 lg:pb-32">
        <div className="flex flex-col items-start gap-7 text-left">
          <Badge
            variant="outline"
            className="border-white/20 bg-white/5 text-xs uppercase tracking-widest text-[oklch(0.85_0.18_85)] backdrop-blur"
          >
            <Zap className="size-3" /> Copa 2026 · {COMPETITION.startLabel} → {COMPETITION.endLabel}
          </Badge>

          <h1 className="font-heading text-5xl uppercase leading-[0.92] tracking-tight sm:text-6xl md:text-7xl lg:text-[5.75rem]">
            Bolão da Copa{" "}
            <span className="text-[oklch(0.85_0.18_85)]">com sangue no olho.</span>
          </h1>

          <p className="max-w-xl text-lg text-white/70 sm:text-xl">
            Palpite os {COMPETITION.totalMatches} jogos da Copa, suba no ranking
            a cada apito final e dispute a camisa da Seleção Brasileira + bolada
            em dinheiro pro pódio da Patota Bisteka.
          </p>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <GoogleSignInButton size="lg" variant="accent" />
            <a
              href="#como-funciona"
              className={
                buttonVariants({ variant: "outline", size: "lg" }) +
                " border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
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
              <dd className="font-heading text-3xl text-white tabular">
                {COMPETITION.totalMatches}
              </dd>
            </div>
            <div className="h-10 w-px bg-white/10" aria-hidden />
            <div className="flex flex-col">
              <dt className="text-xs uppercase tracking-widest text-white/40">
                Países
              </dt>
              <dd className="font-heading text-3xl text-white tabular">
                {COMPETITION.totalCountries}
              </dd>
            </div>
            <div className="h-10 w-px bg-white/10" aria-hidden />
            <div className="flex flex-col">
              <dt className="text-xs uppercase tracking-widest text-white/40">
                Inscrição
              </dt>
              <dd className="font-heading text-3xl text-white tabular">
                {formatBRL(INSCRIPTION_VALUE_BRL)}
              </dd>
            </div>
          </dl>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-[oklch(0.85_0.18_25)]"
            >
              {errorMessage}
            </p>
          )}
        </div>

        <Mascot />
      </div>

      <div className="relative mx-auto -mt-8 max-w-7xl px-6 pb-20 lg:pb-24">
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
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.62_0.20_18/0.45),transparent_60%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_30%_at_85%_30%,oklch(0.85_0.18_85/0.18),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,transparent,oklch(0.14_0.01_30))] [mask-image:linear-gradient(to_bottom,transparent,black_60%)]"
      />
    </>
  );
}

function Mascot() {
  return (
    <div className="relative w-full justify-self-center lg:justify-self-end">
      <div
        aria-hidden
        className="absolute inset-x-8 bottom-2 -z-10 h-16 rounded-full bg-[oklch(0.62_0.20_18/0.35)] blur-3xl"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,oklch(0.85_0.18_85/0.20),transparent_70%)]"
      />
      <Image
        src="/BISTECA.png"
        alt="Mascote Bisteka — porco durão de mohawk e jaqueta de couro"
        width={560}
        height={720}
        priority
        className="motion-safe:animate-float relative mx-auto h-auto w-[clamp(280px,42vw,520px)] drop-shadow-[0_30px_40px_oklch(0.14_0.01_30/0.6)]"
      />
    </div>
  );
}

function Scoreboard() {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div
        aria-hidden
        className="absolute -inset-2 -z-10 rounded-2xl bg-gradient-to-br from-[oklch(0.85_0.18_85/0.25)] to-transparent blur-xl"
      />
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm shadow-[0_0_60px_-20px_oklch(0.85_0.18_85/0.4)]">
        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/40">
          <span>Final · MetLife Stadium</span>
          <span className="inline-flex items-center gap-1.5 text-[oklch(0.85_0.18_85)]">
            <span className="size-1.5 rounded-full bg-[oklch(0.85_0.18_85)] animate-pulse" />
            Ao vivo
          </span>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Team code="BRA" name="Brasil" />
          <div className="flex flex-col items-center gap-1">
            <div className="font-heading text-6xl tracking-tight text-white tabular">
              2 <span className="text-white/30">·</span> 1
            </div>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/50">
              90+3'
            </span>
          </div>
          <Team code="ARG" name="Argentina" align="right" />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-xs">
          <Stat label="Seu palpite" value="2 × 1" hit />
          <Stat label="Pontos" value={`+${FINAL_EXACT_POINTS}`} />
          <Stat label="Rank" value="#3" />
        </div>
      </div>
    </div>
  );
}

function Team({
  code,
  name,
  align = "left",
}: {
  code: string;
  name: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 ${align === "right" ? "items-end text-right" : "items-start"}`}
    >
      <span
        aria-hidden
        className="inline-flex h-9 min-w-12 items-center justify-center rounded-md border border-white/15 bg-white/5 px-2 font-heading text-base tracking-[0.2em] text-white/80"
      >
        {code}
      </span>
      <span className="font-heading text-2xl tracking-wide text-white">
        {name}
      </span>
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
          hit ? "text-[oklch(0.85_0.18_85)]" : "text-white"
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
