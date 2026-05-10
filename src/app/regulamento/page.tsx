// ATENÇÃO: este JSX espelha docs/regulamento.md.
// Ao alterar o regulamento, atualizar AMBOS os arquivos.

import type { ReactNode } from "react";

export const metadata = { title: "Regulamento — BistekaBet" };

export default function RegulamentoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <PageHeader />
      <Toc />
      {/* TODO: as 16 seções entram nas Tasks 2 e 3 */}
    </main>
  );
}

function PageHeader() {
  return (
    <header className="mb-10 flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
        Bolão Copa 2026
      </p>
      <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
        Regulamento
      </h1>
      <p className="text-muted-foreground">
        Regras oficiais do bolão BISTEKA BET.
      </p>
    </header>
  );
}

const TOC_ITEMS = [
  ["objetivo", "1. Objetivo"],
  ["inscricao", "2. Valor da inscrição"],
  ["palpites", "3. Envio dos palpites"],
  ["horario", "4. Horário de referência"],
  ["resultado", "5. Resultado considerado"],
  ["pontuacao", "6. Pontuação geral"],
  ["vencedor", "7. Jogos com vencedor"],
  ["empate", "8. Jogos empatados"],
  ["terceiro", "9. Jogo de 3º lugar"],
  ["adiados", "10. Jogos adiados"],
  ["classificacao", "11. Classificação"],
  ["desempate", "12. Desempate"],
  ["premiacao", "13. Premiação"],
  ["aumento", "14. Aumento de premiados"],
  ["omissos", "15. Casos omissos"],
  ["resumo", "16. Resumo"],
] as const;

function Toc() {
  return (
    <nav className="mb-10 rounded-md border bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
        Sumário
      </p>
      <ol className="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-2 sm:gap-x-4">
        {TOC_ITEMS.map(([id, label]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="text-foreground hover:text-primary hover:underline"
            >
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="font-heading text-2xl uppercase tracking-tight mb-4">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Example({
  result,
  prediction,
  conclusion,
}: {
  result: string;
  prediction: string;
  conclusion: string;
}) {
  return (
    <div className="rounded-md border-l-4 border-primary bg-muted px-4 py-3 my-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
        Exemplo
      </p>
      <p className="font-mono text-sm">Resultado real: {result}</p>
      <p className="font-mono text-sm">Palpite: {prediction}</p>
      <p className="mt-2 text-sm">{conclusion}</p>
    </div>
  );
}

function PointsTable() {
  const rows: Array<[string, number, number, number]> = [
    ["Fase de grupos", 2, 4, 7],
    ["32 avos", 3, 6, 10],
    ["Oitavas", 4, 8, 13],
    ["Quartas", 6, 11, 18],
    ["Semifinal", 8, 15, 25],
    ["3º lugar", 7, 13, 22],
    ["Final", 11, 20, 34],
  ];
  return (
    <div className="my-4 overflow-x-auto rounded-md border">
      <table
        className="w-full text-sm"
        aria-label="Tabela de pontuação por fase"
      >
        <thead className="bg-foreground text-background">
          <tr>
            <th scope="col" className="p-3 text-left">Fase</th>
            <th scope="col" className="p-3 text-right">Vencedor / empate</th>
            <th scope="col" className="p-3 text-right">Vencedor + gols</th>
            <th scope="col" className="p-3 text-right">Placar exato</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([fase, w, wg, ex]) => (
            <tr key={fase} className="border-t hover:bg-muted/50">
              <td className="p-3">{fase}</td>
              <td className="p-3 text-right tabular-nums">{w}</td>
              <td className="p-3 text-right tabular-nums">{wg}</td>
              <td className="p-3 text-right tabular-nums">{ex}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrizeTable() {
  return (
    <div className="my-4 overflow-x-auto rounded-md border">
      <table className="w-full text-sm" aria-label="Tabela de premiação">
        <thead className="bg-foreground text-background">
          <tr>
            <th scope="col" className="p-3 text-left">Colocação</th>
            <th scope="col" className="p-3 text-left">Prêmio</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <td className="p-3">1º lugar</td>
            <td className="p-3">
              1 camisa da Seleção Brasileira + 50% do valor líquido
            </td>
          </tr>
          <tr className="border-t">
            <td className="p-3">2º lugar</td>
            <td className="p-3">
              1 camisa da Seleção Brasileira + 35% do valor líquido
            </td>
          </tr>
          <tr className="border-t">
            <td className="p-3">3º lugar</td>
            <td className="p-3">
              1 camisa da Seleção Brasileira + 15% do valor líquido
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
