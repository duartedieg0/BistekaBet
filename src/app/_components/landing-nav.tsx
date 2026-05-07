import { Trophy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[oklch(0.16_0.02_150)]/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 text-white">
        <a href="#" className="inline-flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[oklch(0.92_0.20_120)] text-[oklch(0.16_0.02_150)]">
            <Trophy className="size-4" />
          </span>
          <span className="font-heading text-2xl tracking-wide">BistekaBet</span>
        </a>

        <nav className="hidden items-center gap-8 text-sm text-white/70 md:flex">
          <a className="transition-colors hover:text-white" href="#como-funciona">
            Como funciona
          </a>
          <a className="transition-colors hover:text-white" href="#prova">
            Depoimentos
          </a>
          <a className="transition-colors hover:text-white" href="#faq">
            FAQ
          </a>
        </nav>

        <a
          href="#cta"
          className={buttonVariants({ variant: "accent" }) + " hidden sm:inline-flex"}
        >
          Entrar
        </a>
      </div>
    </header>
  );
}
