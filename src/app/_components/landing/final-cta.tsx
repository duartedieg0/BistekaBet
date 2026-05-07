import { GoogleSignInButton } from "../google-sign-in-button";

export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden bg-[oklch(0.16_0.02_150)] py-24 text-[oklch(0.97_0.01_145)] sm:py-32">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,oklch(0.62_0.17_145/0.35),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.92_0.20_120/0.6)] to-transparent"
      />

      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[oklch(0.92_0.20_120)]">
          Tá esperando o quê
        </p>
        <h2 className="font-heading text-5xl leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">
          A Copa começa.{" "}
          <span className="text-[oklch(0.92_0.20_120)]">
            E o seu bolão também.
          </span>
        </h2>
        <p className="max-w-2xl text-lg text-white/70">
          Login em um clique. Convida a galera. Curte cada apito final
          conferindo se subiu ou caiu no ranking.
        </p>
        <GoogleSignInButton size="lg" variant="accent" />
        <p className="text-xs text-white/40">
          Sem cartão · Sem cadastro · Sem app pra instalar
        </p>
      </div>
    </section>
  );
}
