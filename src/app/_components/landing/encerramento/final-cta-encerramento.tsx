// src/app/_components/landing/encerramento/final-cta-encerramento.tsx
import Image from "next/image";
import { GoogleSignInButton } from "../../google-sign-in-button";

export function FinalCtaEncerramento() {
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
          Sua campanha, do início ao fim
        </p>
        <h2 className="font-heading text-5xl uppercase leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">
          Reviva a <span className="text-[oklch(0.85_0.18_85)]">sua Copa.</span>
        </h2>
        <p className="max-w-2xl text-lg text-white/70">
          Entre e veja a sua retrospectiva: sua jornada no ranking, seus placares
          cravados e a sua persona da Copa.
        </p>
        <GoogleSignInButton
          size="lg"
          variant="accent"
          label="Entrar e ver minha retrospectiva"
        />
      </div>
    </section>
  );
}
