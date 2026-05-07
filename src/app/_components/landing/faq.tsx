import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const items = [
  {
    q: "Quanto custa para entrar?",
    a: "Zero. O BistekaBet é grátis. Se o seu bolão tem premiação em dinheiro, isso é combinado fora do app, entre os participantes.",
  },
  {
    q: "Posso editar meu palpite depois?",
    a: "Pode, até o apito inicial da partida. A partir do primeiro minuto, o palpite trava e os pontos são apurados no apito final.",
  },
  {
    q: "Como funciona a pontuação?",
    a: "Acerto exato do placar vale 25 pontos. Acerto do vencedor (ou empate) vale 10 pontos. Mata-mata e fases finais valem em dobro.",
  },
  {
    q: "Quem organiza o bolão?",
    a: "Qualquer pessoa pode criar um grupo, definir o nome e convidar a galera por link. Quem cria vira admin do grupo automaticamente.",
  },
  {
    q: "Funciona no celular?",
    a: "Funciona em qualquer navegador moderno — celular, tablet ou desktop. Sem instalar nada.",
  },
];

export function Faq() {
  return (
    <section className="bg-background py-24 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            FAQ
          </p>
          <h2 className="mt-3 font-heading text-4xl tracking-tight sm:text-5xl">
            Perguntas que sempre aparecem no grupo
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Faltou alguma? Manda na criação do bolão que a gente responde.
          </p>
        </div>

        <Accordion className="border-y border-border">
          {items.map(({ q, a }, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="py-5 font-heading text-lg tracking-wide">
                {q}
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {a}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
