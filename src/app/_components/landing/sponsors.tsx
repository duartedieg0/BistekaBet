"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Handshake, Mail, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

type Slot = {
  id: string;
  tier: string;
  title: string;
  description: string;
  perks: string[];
};

const slots: Slot[] = [
  {
    id: "total",
    tier: "Pacote Total",
    title: "Dono da resenha Bisteka Bet",
    description:
      "A marca que entra em campo com a Patota Bisteka do início ao fim.",
    perks: [
      "Logo no topo da home + dashboard ao vivo",
      "Menção em cada notificação de rodada",
      "Logo nas telas de mata-mata",
      "Logo na tela de Classificação",
      "Logo no rodapé",
      "Menção no regulamento oficial",
    ],
  },
  {
    id: "patrono",
    tier: "Pacote Patrono",
    title: "Sua marca no topo do ranking",
    description:
      "Logo em destaque na home, no Resultado ao Vivo e no Grupo de Whatsapp com os resultados da rodada.",
    perks: [
      "Logo no topo da home + dashboard ao vivo",
      "Menção em cada notificação de rodada",
    ],
  },
  {
    id: "oficial",
    tier: "Pacote Oficial",
    title: "Patrocinador da fase eliminatória",
    description:
      "Marca presente nas telas de oitavas, quartas, semis e final — quando o coração bate mais forte e ninguém desgruda do ranking.",
    perks: [
      "Logo nas telas de mata-mata",
      "Logo na tela de Classificação",
    ],
  },
  {
    id: "apoio",
    tier: "Pacote Apoio",
    title: "Apoiador da Patota Bisteka",
    description:
      "Marca no rodapé do bolão e no regulamento oficial.",
    perks: [
      "Logo no rodapé",
      "Menção no regulamento oficial",
    ],
  },
  {
    id: "produto",
    tier: "Permuta / Produto",
    title: "Trocou figurinha com a gente",
    description:
      "Tem produto, serviço ou experiência pra oferecer pro pódio? A gente conversa em formato de permuta e dá o destaque que combina.",
    perks: [
      "Brinde para 1º, 2º ou 3º lugar",
      "Espaço no anúncio do pódio",
      "Tag nas divulgações",
    ],
  },
];

const CONTACT_EMAIL = "patota@bistekabet.com";

export function Sponsors() {
  const trackRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToIndex = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children.item(index) as HTMLElement | null;
    if (!child) return;
    track.scrollTo({ left: child.offsetLeft - track.offsetLeft, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const items = Array.from(track.children) as HTMLElement[];
      const center = track.scrollLeft + track.clientWidth / 2;
      let closest = 0;
      let closestDist = Infinity;
      items.forEach((el, i) => {
        const itemCenter = el.offsetLeft - track.offsetLeft + el.clientWidth / 2;
        const dist = Math.abs(itemCenter - center);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      });
      setActiveIndex(closest);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  const prev = () => scrollToIndex(Math.max(0, activeIndex - 1));
  const next = () => scrollToIndex(Math.min(slots.length - 1, activeIndex + 1));

  return (
    <section className="relative bg-secondary/40 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="size-3.5" /> Cotas abertas
          </p>
          <h2 className="mt-3 font-heading text-4xl tracking-tight sm:text-5xl">
            Patrocine a Patota Bisteka
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A Copa de 2026 dura 39 dias e todo apito final tem gente vidrada no
            ranking. Sua marca pode estar lá no meio.
          </p>
        </div>

        <div className="relative mt-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-12 bg-gradient-to-r from-secondary/60 to-transparent sm:block"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-12 bg-gradient-to-l from-secondary/60 to-transparent sm:block"
          />

          <ul
            ref={trackRef}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Pacotes de patrocínio disponíveis"
          >
            {slots.map((slot, i) => (
              <li
                key={slot.id}
                className="snap-center shrink-0 basis-[85%] sm:basis-[60%] lg:basis-[38%]"
                aria-current={i === activeIndex ? "true" : undefined}
              >
                <Card className="h-full border-2 border-dashed border-foreground/30 bg-card transition-colors hover:border-foreground hover:border-solid">
                  <CardContent className="flex h-full flex-col gap-5 p-7">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
                        {slot.tier}
                      </span>
                      <Handshake className="size-5 text-muted-foreground/60" aria-hidden />
                    </div>
                    <h3 className="font-heading text-2xl tracking-wide">
                      {slot.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {slot.description}
                    </p>
                    <ul className="mt-auto flex flex-col gap-2 border-t border-border/60 pt-4 text-sm">
                      {slot.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-2">
                          <span
                            aria-hidden
                            className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                          />
                          <span className="text-foreground/80">{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={prev}
              disabled={activeIndex === 0}
              aria-label="Pacote anterior"
              className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-foreground"
            >
              <ChevronLeft className="size-5" />
            </button>

            <ol className="flex items-center gap-2" aria-label="Indicadores">
              {slots.map((slot, i) => (
                <li key={slot.id}>
                  <button
                    type="button"
                    onClick={() => scrollToIndex(i)}
                    aria-label={`Ir para ${slot.tier}`}
                    aria-current={i === activeIndex ? "true" : undefined}
                    className={`h-2 rounded-full transition-all ${
                      i === activeIndex
                        ? "w-8 bg-foreground"
                        : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                    }`}
                  />
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={next}
              disabled={activeIndex === slots.length - 1}
              aria-label="Próximo pacote"
              className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-foreground"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <div className="mx-auto mt-14 flex max-w-2xl flex-col items-center gap-4 rounded-xl border border-foreground/10 bg-card/80 p-6 text-center backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">
            Quer fechar um pacote ou montar um formato custom? Fala com a
            organização da Patota Bisteka.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Patroc%C3%ADnio%20BistekaBet%20Copa%202026`}
            className={
              buttonVariants({ variant: "default", size: "lg" }) +
              " inline-flex items-center gap-2"
            }
          >
            <Mail className="size-4" />
            Quero patrocinar
          </a>
          <p className="text-xs text-muted-foreground/80">
            Resposta em até 48h pelo {CONTACT_EMAIL}
          </p>
        </div>
      </div>
    </section>
  );
}
