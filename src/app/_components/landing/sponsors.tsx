"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Handshake, Sparkles } from "lucide-react";
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

  const prev = () => scrollToIndex((activeIndex - 1 + slots.length) % slots.length);
  const next = () => scrollToIndex((activeIndex + 1) % slots.length);

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
            APP. Sua marca pode estar lá no meio.
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
                    <ul className="mt-auto flex flex-col gap-2 text-sm">
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
              aria-label="Pacote anterior"
              className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-foreground hover:text-background"
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
              aria-label="Próximo pacote"
              className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <div className="mx-auto mt-14 flex max-w-2xl flex-col items-center gap-4 rounded-xl border border-foreground/10 bg-card/80 p-6 text-center backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">
            Quer fechar um pacote ou montar um formato custom? Fale com a gente.
          </p>
          <a
            href="https://wa.me/554799680801?text=Olá!%20Quero%20saber%20mais%20sobre%20os%20pacotes%20de%20patrocínio%20do%20Bisteka%20Bet."
            target="_blank"
            className={
              buttonVariants({ variant: "default", size: "lg" }) +
              " inline-flex items-center gap-2"
            }
          >
            <svg
              role="img"
              aria-hidden
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-4"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.297-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.83 9.83 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.82 11.82 0 0 0 20.464 3.488" />
            </svg>
            Quero patrocinar
          </a>
          <p className="text-xs text-muted-foreground/80">
          </p>
        </div>
      </div>
    </section>
  );
}
