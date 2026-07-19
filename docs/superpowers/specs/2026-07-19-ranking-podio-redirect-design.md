# Ranking · Pódio no topo + destaque 4º–10º + redirect na final — Design

**Data:** 2026-07-19
**Página alvo:** `/classificacao` (rotulada "Ranking" no menu).
**Depende de:** `loadRanking()`/`aggregate()` (SP-03), que já entrega `RankingRow[]`
ordenado e com `rank`, `avatar_url`, `display_name`, `total_points`, `exacts_total`.

---

## 1. Objetivo

Reformular a página de Ranking (`/classificacao`) em dois eixos:

1. **Pódio no topo (hero):** apresentar os 3 primeiros em um pódio (2º | 1º | 3º),
   com o 1º ao centro e realçado.
2. **Lista abaixo do pódio:** a sequência de posições a partir do 4º lugar, com
   uma faixa destacada (cor diferente) cobrindo do 4º ao 10º; do 11º em diante,
   neutro.

E um comportamento de "grande final":

3. **Redirect automático:** quando o resultado da **final** estiver preenchido no
   sistema, a home (`/inicio`) passa a redirecionar automaticamente para
   `/classificacao`.

## 2. Não-objetivos

- Alterar a fonte de dados do ranking (`loadRanking`) ou a matemática de
  agregação/desempate (`ranking-core.ts`). Permanecem intactas.
- Mudar o **preview de ranking da home** (`RankingPreview` + `RankingTable`). O
  usuário pediu mudança apenas na **página** de Ranking. O `RankingTable` continua
  servindo o preview, sem alteração visual.
- Redirect a partir de qualquer outra rota além de `/inicio` (decisão: só a home
  redireciona; o usuário continua navegando livremente pelo menu após a final).
- Página de perfil / cards do pódio clicáveis (não existe destino — YAGNI).
- Controle manual (flag de admin) do momento do redirect — é dirigido pelo dado
  real da final.

## 3. Decisões de design

| ID | Decisão | Justificativa |
|---|---|---|
| Q1 | Redirect somente em `/inicio` → `/classificacao` | "Grande final": a entrada do app vira o ranking, sem prender o usuário nas demais páginas. Escolha do usuário sobre as alternativas (funil total / redirect único com cookie). |
| Q2 | Detecção dirigida pelo dado: partida `stage='final'` com `winner_team_id != null` | Fiel a "automático quando o resultado estiver preenchido", sem passo manual. `winner_team_id` é o marcador definitivo de final decidida (cobre prorrogação/pênaltis, onde o placar de 90min pode ser empate). |
| Q3 | Sem cache no `isFinalDecided()` | É uma leitura de **uma linha** — mais barata que a agregação de ranking que a mesma família de páginas já executa. Query direta vira a chave na hora que o admin importa o resultado, sem janela de staleness (YAGNI). |
| Q4 | `try/catch` retornando `false` em erro | Fail-safe: se a query falhar, a home não quebra e não redireciona. Mesmo padrão defensivo de `getAppSetting`. |
| Q5 | Componentes novos e isolados (`RankingPodium`, `RankingList`) | Cada um com uma responsabilidade (hero vs. tabela). Não toca no `RankingTable` da home. Alternativa (estender `RankingTable` com props `showPodium`/`highlightTop10`/`startAt`) foi descartada por acumular dois trabalhos distintos num só componente. |
| Q6 | Lista começa no 4º (`rows.slice(3)`) | Top 3 já estão no pódio; evita repetição. Faixa destacada aplica-se ao 4º–10º. |
| Q7 | Destaque por `rank <= 10` | Como a lista já começa após o pódio, `rank <= 10` cobre exatamente 4º–10º no caso normal. Do 11º em diante, neutro. |
| Q8 | Extrair `MEDAL_COLORS` e a nota de premiação para módulos compartilhados | Reuso entre pódio/lista/preview sem duplicar. Hoje ambos vivem embutidos em `ranking-table.tsx`. |
| Q9 | Alinhar o `<h1>` da página para "Ranking" | Consistência com o rótulo do menu (`AppSidebar`) e com o vocabulário do usuário. |

## 4. Arquitetura

### 4.1 Detecção da final (`src/lib/matches/final-status.ts`) — novo

`server-only`. Split IO/puro, seguindo a convenção do projeto:

- **Puro** — `finalDecidedFromRow(row: { winner_team_id: string | null } | null): boolean`
  → `true` sse `row?.winner_team_id != null`. Unit-testável sem Supabase.
- **IO** — `isFinalDecided(): Promise<boolean>`:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export function finalDecidedFromRow(
  row: { winner_team_id: string | null } | null,
): boolean {
  return row?.winner_team_id != null;
}

export async function isFinalDecided(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("matches")
      .select("winner_team_id")
      .eq("stage", "final")
      .maybeSingle<{ winner_team_id: string | null }>();
    if (error) return false;
    return finalDecidedFromRow(data);
  } catch {
    return false;
  }
}
```

> Nota de implementação: `AGENTS.md` avisa que este Next.js tem convenções
> próprias. Confirmar o import de `redirect` e o padrão de página `async` nos docs
> em `node_modules/next/dist/docs/` antes de codar.

### 4.2 Redirect em `/inicio` (`src/app/(authenticated)/inicio/page.tsx`)

`InicioPage` passa de `function` para `async function`. Primeira instrução do
corpo:

```ts
if (await isFinalDecided()) redirect("/classificacao");
```

Antes da final, o comportamento é idêntico ao atual (o predicado retorna `false`).

### 4.3 Pódio (`src/app/(authenticated)/classificacao/_components/ranking-podium.tsx`) — novo

- Props: `{ rows: RankingRow[] }` (os 3 primeiros).
- Layout: 3 colunas na ordem visual **2º | 1º | 3º**, 1º ao centro, mais alto e com
  avatar maior. Mantém 3 colunas inclusive no mobile, escalando avatar/tipografia.
- Card: `Avatar` (`src/components/ui/avatar.tsx`) com fallback nas iniciais quando
  `avatar_url` é `null`; colocação/medalha (ouro/prata/bronze via `MEDAL_COLORS`
  compartilhado); nome; **`total_points`** em destaque; `exacts_total` como stat
  secundário.
- 1º recebe realce extra (anel/pedestal dourado, avatar maior).
- Colocação exibida a partir de `row.rank` (empates aparecem honestamente — ver §6).

### 4.4 Lista (`src/app/(authenticated)/classificacao/_components/ranking-list.tsx`) — novo

- Props: `{ rows: RankingRow[] }` (a partir do 4º — a página passa `rows.slice(3)`).
- Estrutura: mesma tabela atual (# · Participante · Pontos · Exatos), reusando os
  componentes de `Table`. A célula `#` mostra o número de `row.rank` (sem medalha,
  pois medalhas são só do top 3, que está no pódio).
- Destaque: linha com fundo em leve tint da cor primária quando `row.rank <= 10`
  (intensidade calibrável entre `bg-primary/5` e `bg-primary/10`, à la estado ativo
  da sidebar), possivelmente com filete de acento à esquerda e número em
  `text-primary`. Contraste acessível mantido. Do 11º em diante, neutro.
- Se `rows` vazio (≤3 participantes no total), não renderiza nada.

### 4.5 Página (`src/app/(authenticated)/classificacao/page.tsx`)

```
rows = await loadRanking()
  ├─ rows.length === 0 → estado vazio ("A classificação aparecerá aqui…")
  └─ senão:
       <RankingPodium rows={rows.slice(0, 3)} />
       <RankingList   rows={rows.slice(3)} />
       <PremiacaoNote />
```

- `<h1>` alinhado para "Ranking" (Q9).
- O estado vazio (hoje dentro de `RankingTable`) passa a ser tratado na página,
  pois `/classificacao` deixa de usar `RankingTable`.

### 4.6 Compartilhados extraídos

- `MEDAL_COLORS` (mapa rank→cor) — de `ranking-table.tsx` para um módulo
  compartilhado (ex.: `src/lib/scoring/medal.ts` ou helper de UI). Consumido por
  pódio, lista e `RankingTable`.
- `PremiacaoNote` — componente com o texto "Top 3 levam uma camisa… / ver premiação"
  (hoje no rodapé de `RankingTable`). Reusado pela página e pelo preview da home,
  sem duplicar texto.

### 4.7 Sem mudança

- `loadRanking()`, `ranking-core.ts` (agregação/desempate), `RankingPreview` e o
  visual do `RankingTable` no preview da home.

## 5. Estratégia de testes

Seguindo a convenção do repo (funções puras em vitest; sem testes de componente).

- **`src/lib/matches/__tests__/final-status.test.ts`** — novo. Cobre
  `finalDecidedFromRow`:
  - `null` → `false` (sem partida final encontrada).
  - `{ winner_team_id: null }` → `false` (final ainda sem vencedor).
  - `{ winner_team_id: "<uuid>" }` → `true` (final decidida).
- `isFinalDecided` fica como casca fina de IO sobre o predicado; sem teste dedicado
  (não mockar Supabase).
- Matemática de ranking/desempate **não muda** — `ranking-core.test.ts` continua
  cobrindo.
- Componentes de pódio/lista são finos/presentacionais — sem teste dedicado
  (consistente com o repo).

### Verificação manual (no plano)

Em staging: preencher o vencedor da final (`winner_team_id`) →
1. visitar `/inicio` deve redirecionar para `/classificacao`;
2. pódio exibe top 3 (2º | 1º | 3º), 1º realçado, com avatar/nome/pontos/exatos;
3. lista inicia no 4º com a faixa 4º–10º destacada e 11º+ neutro.

## 6. Riscos e questões em aberto

1. **Empates na fronteira do pódio.** `assignRanks` dá a mesma `rank` a empatados
   (ex.: dois "1º", próximo é "3º"; ou dois "3º"). O pódio pega `rows.slice(0,3)`
   por posição e exibe `row.rank`, então um empate aparece honestamente (dois "1º").
   Num empate de dois no 3º, a lista pode começar mostrando um "3º". Aceito como
   caso raro (há 6 níveis de desempate em `compareForRanking`) e honesto; o
   destaque continua seguindo `rank <= 10`.
2. **Menos de 3 participantes.** Pódio renderiza só os cards existentes; lista pode
   ficar vazia; `rows.length === 0` cai no estado vazio. Cenário improvável quando a
   final já foi decidida, mas tratado defensivamente.
3. **Leitura extra em `/inicio`.** Uma linha por visita à home; trivial na escala de
   um bolão e mais barata que a agregação já presente. Sem cache por decisão (Q3).
4. **Redirect só na home.** Se algum fluxo passar a mandar o usuário direto para
   outra rota autenticada pós-final, o redirect não dispara ali. Aceito: a home é a
   entrada principal e a decisão de escopo foi consciente (Q1).
</content>
</invoke>
