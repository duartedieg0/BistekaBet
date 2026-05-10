# SP-06 Página pública de Regulamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar `/regulamento` como página pública estilizada, espelhando `docs/regulamento.md` em JSX manual, com TOC, tabelas (§6 e §13) e caixas para os exemplos do regulamento; redirecionar links existentes ("Regras") em header/sidebar/footer para a nova rota.

**Architecture:** Rota pública `src/app/regulamento/page.tsx` (Server Component, sem auth). JSX manual — `regulamento.md` continua como referência canônica. Componentes locais (`Section`, `Example`, `PointsTable`, `PrizeTable`, `Toc`) no mesmo arquivo. Sem dependências novas, sem markdown parser.

**Tech Stack:** Next.js 16 App Router · TypeScript · Tailwind v4 · lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-09-sp06-regulamento-design.md`
**Plano macro:** `docs/superpowers/specs/2026-05-09-plano-macro-regulamento.md`
**Depende de:** nada.

**Notas para o executor:**
- npm. TypeScript strict.
- `lucide-react` já é dep; `ScrollText` já está importado em `app-sidebar.tsx`. Não precisa adicionar import novo.
- Header autenticado e sidebar já têm placeholder "Regras" apontando para `/inicio#regras`. Esta SP redireciona para `/regulamento`.
- Landing footer (`src/app/_components/landing-footer.tsx`) tem placeholders `"Regras oficiais"` e `"Pontuação"` com `href: "#"` — passam a apontar para `/regulamento` e `/regulamento#pontuacao`.
- **Conteúdo das 16 seções** vem traduzido de `docs/regulamento.md`. Comparar lado a lado durante a implementação. Não inventar texto.
- Sem testes vitest novos. Validação E2E manual.

---

## File Structure

**Criar:**
- `src/app/regulamento/page.tsx` — página completa (TOC + 16 seções + componentes auxiliares).

**Modificar:**
- `src/app/(authenticated)/_components/auth-header.tsx` — atualizar item "Regras" para apontar a `/regulamento` (label "Regulamento").
- `src/app/(authenticated)/_components/app-sidebar.tsx` — idem.
- `src/app/_components/landing-footer.tsx` — atualizar 2 placeholders.

---

## Task 1: Página `/regulamento` — esqueleto, TOC e cabeçalho

**Files:**
- Create: `src/app/regulamento/page.tsx`

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p src/app/regulamento
```

- [ ] **Step 2: Criar arquivo com esqueleto + utilitários compartilhados**

```tsx
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
```

- [ ] **Step 3: Typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Esperado: rota `/regulamento` aparece no output do build.

- [ ] **Step 4: Commit**

```bash
git add src/app/regulamento/page.tsx
git commit -m "feat(regulamento): scaffold page with TOC and shared primitives"
```

---

## Task 2: Seções 1–8 (objetivo até empates com exemplos)

**Files:**
- Modify: `src/app/regulamento/page.tsx`

- [ ] **Step 1: Adicionar componentes de seção dentro do arquivo**

Adicionar após o componente `PrizeTable` (mantendo ordem alfabética/lógica):

```tsx
function Section1Objetivo() {
  return (
    <Section id="objetivo" title="1. Objetivo">
      <p>
        Este regulamento define as regras oficiais do bolão BISTEKA BET da Copa
        do Mundo 2026, incluindo envio de palpites, pontuação, critérios de
        desempate, premiação e demais condições de participação.
      </p>
      <p>
        O bolão será baseado nos palpites realizados pelos participantes para os
        jogos da Copa do Mundo 2026, sempre considerando o placar do tempo
        normal de cada partida.
      </p>
    </Section>
  );
}

function Section2Inscricao() {
  return (
    <Section id="inscricao" title="2. Valor da inscrição">
      <p>
        O valor da inscrição no bolão será de <strong>R$ 75,00</strong>.
      </p>
      <p>
        O prazo final para pagamento da inscrição será até o{" "}
        <strong>início do primeiro jogo da competição</strong>.
      </p>
    </Section>
  );
}

function Section3Palpites() {
  return (
    <Section id="palpites" title="3. Envio dos palpites">
      <p>Os palpites deverão ser enviados exclusivamente pelo BISTEKA BET.</p>
      <p>
        Cada participante deverá informar o placar de cada jogo antes do
        respectivo prazo limite.
      </p>
      <p>
        O envio e a alteração dos palpites poderão ser feitos{" "}
        <strong>até exatamente o horário oficial de início do jogo</strong>,
        conforme indicado na tabela oficial do bolão.
      </p>
      <p>O controle do prazo será feito automaticamente pelo sistema.</p>
      <p>
        Após o bloqueio automático do sistema, o palpite não poderá mais ser
        incluído ou alterado.
      </p>
      <p>
        Caso o participante não envie o palpite dentro do prazo estabelecido,
        receberá <strong>0 pontos</strong> no respectivo jogo.
      </p>
    </Section>
  );
}

function Section4Horario() {
  return (
    <Section id="horario" title="4. Horário de referência">
      <p>
        O horário válido para envio, alteração e bloqueio dos palpites será
        sempre o horário informado na tabela oficial do bolão.
      </p>
    </Section>
  );
}

function Section5Resultado() {
  return (
    <Section id="resultado" title="5. Resultado considerado para pontuação">
      <p>
        Para fins de pontuação, será considerado apenas o placar ao final do{" "}
        <strong>tempo normal</strong> da partida.
      </p>
      <p>
        Gols marcados em <strong>prorrogação</strong> ou{" "}
        <strong>disputa de pênaltis</strong> não serão considerados.
      </p>
      <p>
        Nas fases eliminatórias, caso uma partida termine empatada no tempo
        normal e uma seleção avance após prorrogação ou pênaltis, o resultado
        válido para o bolão será o empate no tempo normal.
      </p>
    </Section>
  );
}

function Section6Pontuacao() {
  return (
    <Section id="pontuacao" title="6. Pontuação geral">
      <p>A pontuação será não cumulativa.</p>
      <p>
        Isso significa que o participante receberá apenas a maior pontuação
        aplicável ao seu palpite, de acordo com a fase da competição e o tipo de
        acerto.
      </p>
      <PointsTable />
    </Section>
  );
}

function Section7VencedorComExemplos() {
  return (
    <Section id="vencedor" title="7. Regras para jogos com vencedor">
      <p>
        Quando uma partida tiver um vencedor no tempo normal, o participante
        poderá pontuar de três formas:
      </p>

      <h3 className="font-heading text-lg mt-4">7.1. Acerto do vencedor</h3>
      <p>
        Ocorre quando o participante acerta qual seleção venceu a partida, mas
        não acerta o placar exato nem a quantidade de gols de uma das equipes.
      </p>
      <Example
        result="Brasil 2 × 1 França"
        prediction="Brasil 1 × 0 França"
        conclusion="O participante acertou o vencedor da partida."
      />

      <h3 className="font-heading text-lg mt-4">
        7.2. Acerto do vencedor + gols de 1 time
      </h3>
      <p>
        Ocorre quando o participante acerta o vencedor da partida e também
        acerta a quantidade de gols de pelo menos uma das seleções.
      </p>
      <Example
        result="Brasil 2 × 1 França"
        prediction="Brasil 3 × 1 França"
        conclusion="O participante acertou o vencedor e a quantidade de gols da França."
      />
      <Example
        result="Brasil 1 × 0 França"
        prediction="Brasil 2 × 0 França"
        conclusion="O participante acertou o vencedor e a quantidade de gols da França. A quantidade de 0 gols também é válida para essa regra."
      />

      <h3 className="font-heading text-lg mt-4">7.3. Acerto do placar exato</h3>
      <p>Ocorre quando o participante acerta exatamente o placar da partida.</p>
      <Example
        result="Brasil 2 × 1 França"
        prediction="Brasil 2 × 1 França"
        conclusion="O participante acertou o placar exato e receberá apenas a pontuação correspondente, sem acumular outras."
      />
    </Section>
  );
}

function Section8EmpateComExemplos() {
  return (
    <Section id="empate" title="8. Regras para jogos empatados">
      <p>
        Quando uma partida terminar empatada no tempo normal, existirão apenas
        duas possibilidades de pontuação:
      </p>
      <ol className="list-decimal pl-6 space-y-1">
        <li>Acerto do empate;</li>
        <li>Acerto do placar exato.</li>
      </ol>
      <p>
        Não haverá pontuação intermediária por acerto de quantidade de gols de
        uma das equipes em jogos empatados.
      </p>
      <Example
        result="Argentina 1 × 1 Alemanha"
        prediction="Argentina 2 × 2 Alemanha"
        conclusion="O participante acertou o empate, mas não o placar exato."
      />
      <Example
        result="Argentina 1 × 1 Alemanha"
        prediction="Argentina 1 × 1 Alemanha"
        conclusion="O participante acertou o placar exato."
      />
    </Section>
  );
}
```

- [ ] **Step 2: Renderizar as seções no `RegulamentoPage`**

Substituir o `{/* TODO ... */}` pelo bloco:

```tsx
<Section1Objetivo />
<Section2Inscricao />
<Section3Palpites />
<Section4Horario />
<Section5Resultado />
<Section6Pontuacao />
<Section7VencedorComExemplos />
<Section8EmpateComExemplos />
```

- [ ] **Step 3: Typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Esperado: limpo.

- [ ] **Step 4: Commit**

```bash
git add src/app/regulamento/page.tsx
git commit -m "feat(regulamento): sections 1-8 with examples"
```

---

## Task 3: Seções 9–16

**Files:**
- Modify: `src/app/regulamento/page.tsx`

- [ ] **Step 1: Adicionar componentes**

Adicionar após `Section8EmpateComExemplos`:

```tsx
function Section9TerceiroLugar() {
  return (
    <Section id="terceiro" title="9. Jogo de 3º lugar">
      <p>O jogo de disputa de 3º lugar fará parte do bolão.</p>
      <p>
        A pontuação do jogo de 3º lugar será menor que a pontuação da final,
        conforme tabela oficial de pontuação.
      </p>
    </Section>
  );
}

function Section10Adiados() {
  return (
    <Section id="adiados" title="10. Jogos adiados, suspensos ou remarcados">
      <p>
        Em caso de jogo adiado, suspenso ou remarcado, o palpite enviado
        continuará válido, salvo se a organização decidir reabrir os palpites e
        comunicar os participantes.
      </p>
      <p>
        A organização poderá atualizar a tabela do bolão conforme alterações
        oficiais da Copa do Mundo.
      </p>
    </Section>
  );
}

function Section11Classificacao() {
  return (
    <Section id="classificacao" title="11. Classificação">
      <p>A classificação do bolão será atualizada automaticamente pelo sistema.</p>
      <p>
        A pontuação de cada participante será calculada com base nos resultados
        oficiais considerados pelo bolão e nas regras de pontuação definidas
        neste regulamento.
      </p>
    </Section>
  );
}

function Section12Desempate() {
  return (
    <Section id="desempate" title="12. Critérios de desempate">
      <p>
        Em caso de empate na pontuação total ao final do bolão, serão aplicados
        os seguintes critérios, nesta ordem:
      </p>
      <ol className="list-decimal pl-6 space-y-1">
        <li>Maior número de placares exatos em todo o torneio;</li>
        <li>Maior número de placares exatos nas fases eliminatórias;</li>
        <li>Maior número de acertos de vencedor ou empate em todo o torneio;</li>
        <li>Maior pontuação obtida na final;</li>
        <li>Maior pontuação somada nas semifinais, disputa de 3º lugar e final;</li>
        <li>Persistindo o empate, o vencedor será definido por sorteio.</li>
      </ol>
      <p>Para o segundo critério, serão consideradas fases eliminatórias:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li>32 avos;</li>
        <li>Oitavas;</li>
        <li>Quartas;</li>
        <li>Semifinais;</li>
        <li>Disputa de 3º lugar;</li>
        <li>Final.</li>
      </ul>
    </Section>
  );
}

function Section13Premiacao() {
  return (
    <Section id="premiacao" title="13. Premiação">
      <p>
        A premiação inicial do bolão será destinada aos três primeiros
        colocados da classificação final.
      </p>
      <p>
        Cada um dos três primeiros colocados receberá{" "}
        <strong>1 camisa da Seleção Brasileira</strong>.
      </p>
      <p>
        O custo das três camisas será descontado do valor total arrecadado
        antes da divisão da premiação em dinheiro.
      </p>
      <p>
        Após o desconto referente às camisas, o valor líquido restante será
        distribuído da seguinte forma:
      </p>
      <PrizeTable />
    </Section>
  );
}

function Section14AumentoPremiados() {
  return (
    <Section id="aumento" title="14. Aumento da quantidade de premiados">
      <p>
        Caso a quantidade de participantes inscritos aumente, a organização
        poderá ampliar a quantidade de pessoas premiadas e ajustar a
        distribuição da premiação.
      </p>
      <p>
        Qualquer alteração na quantidade de premiados ou na divisão dos prêmios
        será comunicada aos participantes antes do início do bolão.
      </p>
    </Section>
  );
}

function Section15CasosOmissos() {
  return (
    <Section id="omissos" title="15. Casos omissos">
      <p>
        Casos omissos ou situações não previstas neste regulamento serão
        analisados e decididos pela organização do bolão, sempre buscando
        preservar a transparência e a igualdade entre os participantes.
      </p>
    </Section>
  );
}

function Section16Resumo() {
  return (
    <Section id="resumo" title="16. Resumo das principais regras">
      <ul className="list-disc pl-6 space-y-1">
        <li>Valor da inscrição: <strong>R$ 75,00</strong>;</li>
        <li>Palpites enviados exclusivamente pelo webapp oficial;</li>
        <li>Palpites podem ser enviados ou alterados até exatamente o horário oficial de início do jogo;</li>
        <li>Palpite não enviado dentro do prazo vale <strong>0 pontos</strong>;</li>
        <li>Apenas o placar do tempo normal será considerado;</li>
        <li>Prorrogação e pênaltis não contam;</li>
        <li>Pontuação não cumulativa;</li>
        <li>Em jogos empatados, só há pontuação por empate ou placar exato;</li>
        <li>0 gol conta como quantidade de gols acertada em jogos com vencedor;</li>
        <li>O jogo de 3º lugar faz parte do bolão;</li>
        <li>A classificação será atualizada automaticamente;</li>
        <li>A premiação inicial será para os 3 primeiros colocados;</li>
        <li>Cada um dos 3 primeiros colocados receberá 1 camisa da Seleção Brasileira;</li>
        <li>O valor das camisas será descontado antes da divisão do prêmio em dinheiro;</li>
        <li>O valor líquido será dividido em 50%, 35% e 15%;</li>
        <li>A quantidade de premiados poderá aumentar caso haja mais participantes;</li>
        <li>Casos omissos serão decididos pela organização.</li>
      </ul>
    </Section>
  );
}
```

- [ ] **Step 2: Renderizar no `RegulamentoPage`**

Adicionar após `<Section8EmpateComExemplos />`:

```tsx
<Section9TerceiroLugar />
<Section10Adiados />
<Section11Classificacao />
<Section12Desempate />
<Section13Premiacao />
<Section14AumentoPremiados />
<Section15CasosOmissos />
<Section16Resumo />
```

- [ ] **Step 3: Typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Esperado: limpo.

- [ ] **Step 4: Commit**

```bash
git add src/app/regulamento/page.tsx
git commit -m "feat(regulamento): sections 9-16"
```

---

## Task 4: Atualizar links no header autenticado e sidebar

**Files:**
- Modify: `src/app/(authenticated)/_components/auth-header.tsx`
- Modify: `src/app/(authenticated)/_components/app-sidebar.tsx`

- [ ] **Step 1: `auth-header.tsx` — atualizar item "Regras"**

Localizar:
```ts
{ href: "/inicio#regras", label: "Regras" },
```

Trocar por:
```ts
{ href: "/regulamento", label: "Regulamento" },
```

- [ ] **Step 2: `app-sidebar.tsx` — atualizar item "Regras"**

Localizar:
```ts
{ href: "/inicio#regras", label: "Regras", icon: ScrollText },
```

Trocar por:
```ts
{ href: "/regulamento", label: "Regulamento", icon: ScrollText },
```

(`ScrollText` já está importado de `lucide-react` no arquivo.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Esperado: limpo.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authenticated)/_components/auth-header.tsx" "src/app/(authenticated)/_components/app-sidebar.tsx"
git commit -m "feat(header): point Regulamento nav to /regulamento"
```

---

## Task 5: Atualizar landing footer

**Files:**
- Modify: `src/app/_components/landing-footer.tsx`

- [ ] **Step 1: Localizar e ajustar 2 placeholders**

Linhas atuais (referência):
```ts
{ label: "Pontuação", href: "#" },
// ...
{ label: "Regras oficiais", href: "#" },
```

Trocar para:
```ts
{ label: "Pontuação", href: "/regulamento#pontuacao" },
// ...
{ label: "Regras oficiais", href: "/regulamento" },
```

Demais hrefs `"#"` no footer ficam como estão (escopo apenas regulamento).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Esperado: limpo.

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/landing-footer.tsx
git commit -m "feat(landing): point footer to /regulamento"
```

---

## Task 6: Verificação final

**Files:** nenhum.

- [ ] **Step 1: Suíte de testes**

Run: `npm test`
Esperado: ≥ **82 tests passing** (sem novos).

- [ ] **Step 2: Typecheck e build**

Run: `npx tsc --noEmit && npm run build`
Esperado: rota `/regulamento` listada no build.

- [ ] **Step 3: Smoke E2E manual**

1. **Deslogado:** acessar `/regulamento`. Página renderiza com header, TOC e 16 seções.
2. Comparar lado a lado com `docs/regulamento.md` — texto equivalente; nenhuma cláusula faltando ou alterada.
3. Tabelas §6 e §13 visíveis; em mobile (≤640px) deslizam horizontalmente sem quebrar layout.
4. Caixas de exemplo (§7.1, §7.2 ex.1/ex.2, §7.3, §8 ex.1/ex.2) com borda esquerda colorida.
5. TOC: clicar em cada item navega para a seção; URL muda para `#<id>`; scroll respeita `scroll-mt-24`.
6. Acessar `/regulamento#pontuacao` direto — abre na seção §6.
7. **Logado:** header e sidebar mostram "Regulamento"; clicar leva para a página.
8. **Landing pública:** footer mostra "Regras oficiais" e "Pontuação" levando à rota; smoke ambos.
9. Dark mode (se houver toggle): tabelas e caixas continuam legíveis.
10. Sem regressões: `/inicio`, `/palpites`, `/classificacao`, `/admin` carregam normalmente.

---

## Done criteria

- [x] `/regulamento` existe como rota pública.
- [x] 16 seções renderizadas, espelhando `docs/regulamento.md`.
- [x] Tabelas §6 e §13 estilizadas com header destacado e overflow horizontal.
- [x] Caixas para os exemplos do regulamento (§7.1, §7.2, §7.3, §8).
- [x] TOC com 16 itens e anchor links funcionais.
- [x] Header autenticado, sidebar e landing footer apontam para `/regulamento`.
- [x] `npm test`, `npx tsc --noEmit`, `npm run build` passam.
- [x] Smoke E2E manual concluído.
