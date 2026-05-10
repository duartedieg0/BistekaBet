import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { INSCRIPTION_VALUE_BRL, formatBRL } from "@/lib/bolao-config";

const items = [
  {
    q: "Quanto custa para entrar?",
    a: `A inscrição é de ${formatBRL(
      INSCRIPTION_VALUE_BRL,
    )}, com prazo de pagamento até o início do primeiro jogo da Copa. Sem o pagamento dentro do prazo o palpite não vale.`,
  },
  {
    q: "Posso editar meu palpite depois de enviar?",
    a: "Pode, até exatamente o horário oficial de início do jogo. O sistema bloqueia automaticamente nesse momento — depois disso o palpite trava e não pode mais ser alterado.",
  },
  {
    q: "Como funciona a pontuação?",
    a: "A pontuação varia por fase e cresce conforme avança a Copa: começa em 2 pontos por acerto de vencedor na fase de grupos e chega a 34 pontos por placar exato na final. Tabela completa no regulamento.",
  },
  {
    q: "E se a partida tiver prorrogação ou pênaltis?",
    a: "Vale só o tempo normal. Se uma partida termina empatada em 90 minutos e a seleção avança nos pênaltis, o resultado considerado pelo bolão é o empate.",
  },
  {
    q: "Como é a premiação?",
    a: "Os 3 primeiros levam, cada um, 1 camisa da Seleção Brasileira. O valor líquido é dividido em 50% / 35% / 15% entre 1º, 2º e 3º. Se mais gente entrar, a organização pode ampliar a quantidade de premiados.",
  },
  {
    q: "E se empatar a pontuação no final?",
    a: "Os critérios de desempate, em ordem: mais placares exatos no torneio inteiro, mais placares exatos nas eliminatórias, mais acertos de vencedor/empate, maior pontuação na final, soma de semifinais + 3º lugar + final, e por fim sorteio.",
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
            Faltou alguma? Confere o{" "}
            <a
              href="/regulamento"
              className="text-primary underline-offset-4 hover:underline"
            >
              regulamento completo
            </a>{" "}
            ou pergunta pra organização da Patota Bisteka.
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
