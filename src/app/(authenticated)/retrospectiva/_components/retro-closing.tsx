import type { Persona } from "@/lib/retro/personas";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RetroClosing({ persona: _persona }: { persona: Persona }) {
  return (
    <section className="flex flex-col items-center gap-8 text-center">
      <div className="flex flex-col gap-4">
        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
          Que jornada, hein? Foram 39 dias torcendo juntos — até por Jordânia ×
          Argélia. Obrigado por viver a Copa com a gente. Que na próxima o Brasil
          venha mais competitivo e traga o Hexa. 🇧🇷
        </p>
      </div>

      <a
        href="#retro-card"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Compartilhe sua Retrospectiva
      </a>
    </section>
  );
}
