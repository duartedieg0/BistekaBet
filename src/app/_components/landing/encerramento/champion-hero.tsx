// src/app/_components/landing/encerramento/champion-hero.tsx
import Image from "next/image";
import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/app/(authenticated)/_components/avatar-fallback";
import { GoogleSignInButton } from "../../google-sign-in-button";
import { COMPETITION } from "@/lib/bolao-config";
import type { RankingRow } from "@/lib/scoring/ranking-core";

export function ChampionHero({
  champions,
  errorMessage,
}: {
  champions: RankingRow[];
  errorMessage?: string | null;
}) {
  const multiple = champions.length > 1;

  return (
    <section className="relative isolate overflow-hidden bg-[oklch(0.14_0.01_30)] text-[oklch(0.97_0.01_60)]">
      <BackgroundDecor />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pt-20 pb-24 lg:grid-cols-[1.15fr_1fr] lg:gap-10 lg:pt-28 lg:pb-32">
        <div className="flex flex-col items-start gap-7 text-left">
          <Badge
            variant="outline"
            className="border-white/20 bg-white/5 text-xs uppercase tracking-widest text-[oklch(0.85_0.18_85)] backdrop-blur"
          >
            <Crown className="size-3" /> Copa 2026 · Encerrada ·{" "}
            {COMPETITION.startLabel} → {COMPETITION.endLabel}
          </Badge>

          <h1 className="font-heading text-5xl uppercase leading-[0.92] tracking-tight sm:text-6xl md:text-7xl lg:text-[5.75rem]">
            A Copa acabou.{" "}
            <span className="text-[oklch(0.85_0.18_85)]">
              {multiple ? "Temos campeões." : "Temos um campeão."}
            </span>
          </h1>

          <p className="max-w-xl text-lg text-white/70 sm:text-xl">
            39 dias, {COMPETITION.totalMatches} jogos e muita resenha. Veja quem
            levantou a taça do bolão da Patota Bistekas e Equipe Coringas.
          </p>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <GoogleSignInButton
              size="lg"
              variant="accent"
              label="Entrar e ver minha retrospectiva"
            />
            <a
              href="#classificacao"
              className={
                buttonVariants({ variant: "outline", size: "lg" }) +
                " border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              }
            >
              Ver classificação
            </a>
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-[oklch(0.85_0.18_25)]"
            >
              {errorMessage}
            </p>
          )}
        </div>

        <ChampionShowcase champions={champions} />
      </div>
    </section>
  );
}

function BackgroundDecor() {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,oklch(0.85_0.18_85/0.28),transparent_60%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_30%_at_85%_30%,oklch(0.62_0.20_18/0.20),transparent_70%)]"
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

function ChampionShowcase({ champions }: { champions: RankingRow[] }) {
  return (
    <div className="relative w-full justify-self-center lg:justify-self-end">
      {/* Spotlight dourado (shimmer contido, Q9) */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_60%_at_50%_40%,oklch(0.85_0.18_85/0.30),transparent_70%)]"
      />

      {champions.length > 0 ? (
        <div className="flex flex-wrap items-end justify-center gap-8">
          {champions.map((c) => (
            <div
              key={c.user_id}
              className="flex flex-col items-center gap-3 duration-700 ease-out animate-in fade-in slide-in-from-bottom-4"
            >
              <div className="relative">
                <Crown
                  className="absolute -top-9 left-1/2 size-9 -translate-x-1/2 animate-float text-[oklch(0.85_0.18_85)] drop-shadow"
                  aria-hidden
                />
                <Avatar className="size-32 ring-4 ring-[oklch(0.85_0.18_85)] shadow-[0_0_70px_-10px_oklch(0.85_0.18_85/0.75)] sm:size-40">
                  {c.avatar_url ? <AvatarImage src={c.avatar_url} alt="" /> : null}
                  <AvatarFallback className="bg-white/10 font-heading text-3xl uppercase text-white">
                    {getInitials(c.display_name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <span className="rounded-full bg-[oklch(0.85_0.18_85)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[oklch(0.14_0.01_30)]">
                Campeão
              </span>
              <p className="font-heading text-2xl uppercase tracking-wide text-white">
                {c.display_name}
              </p>
              <p className="flex items-baseline gap-1.5">
                <span className="font-heading text-4xl tabular-nums text-[oklch(0.85_0.18_85)]">
                  {c.total_points}
                </span>
                <span className="text-xs uppercase tracking-widest text-white/50">
                  pts
                </span>
              </p>
              <p className="text-xs tabular-nums text-white/50">
                {c.exacts_total} placares cravados
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Logos mantidos da Hero (mascote + Coringas) */}
      <div className="mt-10 flex items-end justify-center gap-6">
        <Image
          src="/BISTECA.png"
          alt="Mascote Bisteka"
          width={240}
          height={309}
          className="motion-safe:animate-float h-auto w-[clamp(120px,18vw,200px)] drop-shadow-[0_30px_40px_oklch(0.14_0.01_30/0.6)]"
        />
        <Image
          src="/logo_coringas.png"
          alt="Logo Equipe Coringas — parceria"
          width={707}
          height={1000}
          className="h-auto w-[clamp(90px,13vw,150px)] drop-shadow-[0_20px_30px_oklch(0.14_0.01_30/0.6)]"
        />
      </div>
    </div>
  );
}
