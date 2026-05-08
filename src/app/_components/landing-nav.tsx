import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[oklch(0.14_0.01_30)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 text-white">
        <a href="#" className="inline-flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10">
            <Image
              src="/BISTECA.png"
              alt=""
              width={36}
              height={36}
              priority
              className="size-9 object-contain"
            />
          </span>
          <span className="font-heading text-2xl tracking-wide uppercase">
            Bisteka<span className="text-[oklch(0.85_0.18_85)]">Bet</span>
          </span>
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
