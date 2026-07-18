import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export function RetroBanner() {
  return (
    <Link
      href="/retrospectiva"
      className="group mb-8 flex items-center justify-between gap-4 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 px-6 py-5 transition-colors hover:border-primary/50"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="flex flex-col">
          <span className="font-heading text-xl uppercase tracking-tight">
            Sua Copa acabou — veja sua Retrospectiva
          </span>
          <span className="text-sm text-muted-foreground">
            Sua jornada, sua persona e um card pra compartilhar. 🇧🇷
          </span>
        </div>
      </div>
      <ArrowRight
        className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1"
        aria-hidden
      />
    </Link>
  );
}
