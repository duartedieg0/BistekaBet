# SP-06 · Página pública de Regulamento — Design

**Data:** 2026-05-09
**Plano macro:** [`2026-05-09-plano-macro-regulamento.md`](./2026-05-09-plano-macro-regulamento.md)
**Depende de:** nada.
**Cláusulas cobertas:** §1–§16 (acesso público).

---

## 1. Objetivo

Disponibilizar `docs/regulamento.md` como uma página pública estilizada em
`/regulamento`, acessível por:

- Header autenticado (item de menu novo).
- Sidebar autenticada (item de menu novo).
- Landing pública (rotas "Regras oficiais" e "Pontuação" no footer já apontam para `#` — vão para `/regulamento`).

A página é JSX manual — `regulamento.md` continua como referência canônica para
edição. Sem dependências novas, sem markdown parser.

## 2. Não-objetivos

- Versionamento explícito do regulamento (data de vigência, histórico). Atualizar = commit.
- Diff visual entre versões.
- Tradução / localização (pt-BR apenas).
- TOC sticky lateral (TOC simples no topo).
- Markdown renderer ou MDX.

## 3. Decisões de design

| ID | Decisão | Justificativa |
|---|---|---|
| Q1 | Rota pública `/regulamento` (fora de `(authenticated)`) | Documento é parte do contrato; visível antes do login |
| Q2 | JSX manual; `docs/regulamento.md` permanece como referência | Sem dep nova, controle total de estilização, sem parser em runtime |
| Q3 | Estilização C: caixas para exemplos + tabelas com header destacado | Decisão Q3 do brainstorm; melhora leitura sem exigir `prose` |
| Q4 | Linkagem i: header autenticado + sidebar + footer público | Acesso fácil para candidatos e participantes |
| Q5 | Sem TSX por seção em arquivos separados — tudo em `page.tsx` enquanto o documento for único | YAGNI; evita explodir em 16 arquivos |
| Q6 | TOC com 16 itens no topo da página | Documento longo; navegação rápida em mobile |
| Q7 | Comentário no topo do TSX: "espelha `docs/regulamento.md`" | Alerta para futura divergência (risco aceito Q2) |

## 4. Arquitetura

### 4.1 Rota

`src/app/regulamento/page.tsx` — Server Component, sem auth, sem dados.

```tsx
// ATENÇÃO: este JSX espelha docs/regulamento.md.
// Ao alterar o regulamento, atualizar AMBOS os arquivos.

export const metadata = { title: "Regulamento — BistekaBet" };

export default function RegulamentoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <PageHeader />
      <Toc />
      <Section1Objetivo />
      <Section2Inscricao />
      <Section3Palpites />
      <Section4Horario />
      <Section5Resultado />
      <Section6Pontuacao />
      <Section7VencedorComExemplos />
      <Section8EmpateComExemplos />
      <Section9TerceiroLugar />
      <Section10Adiados />
      <Section11Classificacao />
      <Section12Desempate />
      <Section13Premiacao />
      <Section14AumentoPremiados />
      <Section15CasosOmissos />
      <Section16Resumo />
    </main>
  );
}
```

### 4.2 Componentes locais (mesmo arquivo)

```tsx
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

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="font-heading text-2xl uppercase tracking-tight mb-4">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Example({ result, prediction, conclusion }: { result: string; prediction: string; conclusion: string }) {
  return (
    <div className="rounded-md border-l-4 border-primary bg-muted px-4 py-3 my-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Exemplo</p>
      <p className="font-mono text-sm">Resultado real: {result}</p>
      <p className="font-mono text-sm">Palpite: {prediction}</p>
      <p className="mt-2 text-sm">{conclusion}</p>
    </div>
  );
}

function Toc() {
  const items = [
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
  return (
    <nav className="mb-10 rounded-md border bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Sumário</p>
      <ol className="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-2 sm:gap-x-4">
        {items.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`} className="text-foreground hover:text-primary hover:underline">
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

### 4.3 Tabelas estilizadas (§6 e §13)

```tsx
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
      <table className="w-full text-sm" aria-label="Tabela de pontuação por fase">
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
            <td className="p-3">1 camisa da Seleção Brasileira + 50% do valor líquido</td>
          </tr>
          <tr className="border-t">
            <td className="p-3">2º lugar</td>
            <td className="p-3">1 camisa da Seleção Brasileira + 35% do valor líquido</td>
          </tr>
          <tr className="border-t">
            <td className="p-3">3º lugar</td>
            <td className="p-3">1 camisa da Seleção Brasileira + 15% do valor líquido</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

### 4.4 Conteúdo das seções

Cada `SectionN*` traduz a cláusula em JSX:

- §7 (`Section7VencedorComExemplos`): texto introdutório + 3 sub-blocos (`§7.1`, `§7.2`, `§7.3`) cada um com 1+ `<Example>`.
- §8 (`Section8EmpateComExemplos`): introdução + 2 `<Example>`.
- §6 usa `<PointsTable />`. §13 usa `<PrizeTable />`.
- §16 é uma `<ul>` com bullets do resumo.

### 4.5 Linkagem

**Header autenticado** — `src/app/(authenticated)/_components/auth-header.tsx`:
```ts
const NAV = [
  { href: "/inicio", label: "Início" },
  { href: "/palpites", label: "Palpites" },
  { href: "/classificacao", label: "Ranking" },
  { href: "/regulamento", label: "Regulamento" }, // NOVO
];
```

**Sidebar autenticada** — `src/app/(authenticated)/_components/app-sidebar.tsx`:
```ts
import { ScrollText } from "lucide-react";
// ...
{ href: "/regulamento", label: "Regulamento", icon: ScrollText },
```

**Footer público** — `src/app/_components/landing-footer.tsx`: substituir os hrefs `"#"` em "Regras oficiais" e "Pontuação" por `/regulamento` e `/regulamento#pontuacao`. Demais hrefs `"#"` ficam como estão.

## 5. Estratégia de testes

- **Sem teste vitest novo.**
- **Smoke E2E manual:**
  1. `/regulamento` deslogado → carrega.
  2. Logado → mesmo conteúdo, header autenticado mostra item "Regulamento".
  3. Cada seção renderiza; tabelas §6 e §13 visíveis e acessíveis em mobile (overflow-x).
  4. Anchor links funcionam (clicar TOC navega; URL muda; scroll-mt evita corte sob header).
  5. Comparar lado a lado com `docs/regulamento.md` para garantir conteúdo equivalente.

## 6. Riscos e questões em aberto

1. **Divergência md ↔ TSX** — comentário no topo lembra que ambos precisam ser atualizados juntos. Sem mecanismo automático.
2. **Ícone `ScrollText`** — `lucide-react` 1.14+ deve ter; fallback para `FileText`. Plano valida.
3. **Layout sem header global** — `/regulamento` está fora de `(authenticated)`; herda apenas `RootLayout`. Plano confirma se há `LandingNav` reutilizável; se sim, incluir minimamente. Caso contrário, "← Voltar para BistekaBet" como link `<Link href="/">` no topo.
4. **Acessibilidade** — `<th scope>`, `aria-label` em tabelas, `scroll-mt-24` para anchor links. Plano inclui.
5. **Responsivo** — `max-w-3xl` + `overflow-x-auto` cobrem; smoke confirma.
6. **`/regulamento#pontuacao` na landing** — anchor `pontuacao` está definida na §6.

## 7. Como SPs futuros consomem

- **SP-07 (premiação)** lê o regulamento como referência de conteúdo (não como módulo). Não há import.
