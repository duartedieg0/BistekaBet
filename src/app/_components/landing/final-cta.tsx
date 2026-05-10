import Image from "next/image";
import { GoogleSignInButton } from "../google-sign-in-button";
import { INSCRIPTION_VALUE_BRL, formatBRL } from "@/lib/bolao-config";

export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden bg-[oklch(0.14_0.01_30)] py-24 text-[oklch(0.97_0.01_60)] sm:py-32">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,oklch(0.62_0.20_18/0.35),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.85_0.18_85/0.6)] to-transparent"
      />

      <div className="mx-auto flex max-w-4xl flex-col items-center gap-7 px-6 text-center">
        <Image
          src="/BISTECA.png"
          alt=""
          width={120}
          height={154}
          className="h-28 w-auto drop-shadow-[0_20px_30px_oklch(0.14_0.01_30/0.6)]"
        />
        <p className="text-xs font-semibold uppercase tracking-widest text-[oklch(0.85_0.18_85)]">
          Tá esperando o quê
        </p>
        <h2 className="font-heading text-5xl uppercase leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">
          A Copa começa.{" "}
          <span className="text-[oklch(0.85_0.18_85)]">
            E a resenha também.
          </span>
        </h2>
        <p className="max-w-2xl text-lg text-white/70">
          Faça seu login com um clique
        </p>
        <GoogleSignInButton size="lg" variant="accent" />
        <p className="text-xs text-white/40">
          Inscrição {formatBRL(INSCRIPTION_VALUE_BRL)}
        </p>
      </div>
    </section>
  );
}
