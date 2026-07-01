# Raio-X do jogador — Design

## Contexto

O bolão já tem a **Classificação** (`/classificacao`), que mostra a foto atual do
ranking, e o card **"Sua posição"** na home, que resume rank, pontos e "na mosca"
do usuário logado. Falta uma visão **longitudinal**: como a **posição** e a
**pontuação** de cada participante evoluíram ao longo da Copa 2026, do primeiro
resultado até o dia atual.

O **Raio-X** é uma página pessoal que conta essa história. O protagonista é um
gráfico da **posição (rank) ao longo do tempo**, com um ponto por dia da Copa em
que houve jogos encerrados, apoiado por cards de destaque e uma tabela dia a dia.

Não há tabela de histórico no banco. A trajetória é **reconstruída sob demanda**
a partir dos `prediction_scores`, mantendo uma única fonte de verdade e evitando
jobs/triggers de snapshot.

## Escopo

- Rota `src/app/(authenticated)/raio-x/page.tsx`, **Server Component**, sempre do
  **usuário logado** (sem `[userId]`). Protegida pelo `(authenticated)/layout.tsx`
  existente.
- **Gráfico herói:** posição (rank) ao longo do tempo, **eixo Y invertido** (#1 no
  topo), **um ponto por dia** da Copa com jogos encerrados.
- **Cards de destaque:** posição atual, melhor posição já alcançada, maior subida
  num único dia, total de pontos, "na mosca" (placares exatos).
- **Tabela dia a dia:** data · jogos do dia · pontos do dia · posição · variação
  (seta ↑/↓), do dia mais recente para o mais antigo.
- **Acesso:** nova aba **"Raio-X"** no menu principal (desktop + mobile) e um link
  no card **"Sua posição"** da home.
- O rank diário considera **todos os profiles** (mesma base do `loadRanking`), pra
  bater exatamente com a Classificação.

### Fora de escopo (YAGNI)

- Raio-X de outros jogadores (`/raio-x/[userId]`), comparação com líder/média,
  linha de referência sobreposta no gráfico.
- Breakdown de acertos por fase / por tipo de acerto.
- Export, compartilhamento por URL/imagem.
- Tabela de snapshots persistidos no banco (a reconstrução é sob demanda).
- Simular prorrogação/pênaltis: a pontuação usa só o placar de tempo normal, como
  no resto do motor.

## Arquitetura

### Fluxo de dados (server → client)

```
page.tsx (RSC)
  ├─ getUser() → userId
  ├─ loadRaioX(userId)                       [server-only: src/lib/scoring/raio-x.ts]
  │     ├─ profiles(id, display_name, avatar_url, paid)
  │     ├─ prediction_scores + matches!inner(stage, kickoff_at)  (paginateAll, teto 1000)
  │     ├─ buildRaioXTimeline(...)            [core puro: raio-x-core.ts]
  │     └─ { timeline, highlights, hasData }
  │
  ├─ <HighlightCards ... />                   (server, estático)
  ├─ <RankTimelineChart timeline={...} />     (ILHA "use client" — recharts)
  └─ <DailyTable rows={...} />                (server, estático)
```

recharts é **client-only**, então o gráfico é uma **ilha `"use client"`**
alimentada por dados já calculados no server (props JSON serializáveis). Usar
**recharts v3** (compatível com React 19; a v2 declara peer dep só até React 18);
a versão exata é validada na instalação.

### Estrutura de arquivos

```
src/lib/scoring/
  raio-x-core.ts                   # novo: buildRaioXTimeline (função pura)
  raio-x.ts                        # novo: loadRaioX (server-only, queries)
  __tests__/
    raio-x-core.test.ts            # novo

src/app/(authenticated)/raio-x/
  page.tsx                         # novo: RSC, monta a página
  _components/
    rank-timeline-chart.tsx        # novo: ilha "use client" (recharts)
    highlight-cards.tsx            # novo: server, grid de Card
    daily-table.tsx                # novo: server, Table
    raio-x-empty.tsx               # novo: estado vazio

src/app/(authenticated)/_components/
  auth-header.tsx                  # editado: novo item no array NAV

src/app/(authenticated)/inicio/_components/
  sua-posicao-card.tsx             # editado: link "Ver meu raio-x"
```

### Camada de dados

`loadRaioX` (`server-only`) espelha o `loadRanking`, mas o join traz também o
`kickoff_at`:

```ts
supabase.from("prediction_scores")
  .select("user_id, points, tier, matches!inner(stage, kickoff_at)")
  .order("prediction_id", { ascending: true }).range(from, to)  // via paginateAll
```

Mais `profiles(id, display_name, avatar_url, paid)`. Propaga erros com `throw`
(padrão do `loadRanking`), deixando o error boundary do Next tratar.

### Core puro — `buildRaioXTimeline`

Reaproveita `applyScoreToEntry` / `compareForRanking` / `assignRanks` do
`ranking-core.ts`, garantindo que o rank diário siga **exatamente** a regra da
Classificação (sem divergência).

Entrada normalizada — `scores[]` com `{ user_id, points, tier, stage, day }`, onde
`day` = dia São Paulo (`YYYY-MM-DD`) do `kickoff_at`, derivado com o padrão do
`sao-paulo-day.ts` (fuso `America/Sao_Paulo`).

Algoritmo:

1. Coleta os **dias distintos** presentes nos scores, em ordem crescente — esse é
   o eixo X (só dias com jogos encerrados aparecem).
2. Para cada dia `D`, **acumulado**: agrega todos os scores com `day ≤ D`,
   ranqueia todos os profiles, lê a linha do `userId`.
3. Monta o ponto do dia: `{ day, rank, cumulativePoints, pointsThatDay,
   matchesThatDay, delta }`, com `delta = rankDiaAnterior − rankDoDia` (positivo =
   subiu).

Começo com a versão simples (re-agrega por dia). Se necessário, troco por
acumulação incremental (um `Map` de entries que recebe só os scores do dia) **sem
mudar a interface**. Escala: ~39 dias × ~1–2 mil scores é trivial num request RSC.

Saída:

```ts
type TimelinePoint = {
  day: string;              // YYYY-MM-DD (dia São Paulo)
  rank: number;
  cumulativePoints: number;
  pointsThatDay: number;
  matchesThatDay: number;
  delta: number;            // rank anterior - rank do dia (dia 1 = 0)
};

type RaioXResult = {
  timeline: TimelinePoint[];
  highlights: {
    currentRank: number;
    totalPlayers: number;
    bestRank: number;       bestRankDay: string;
    biggestClimb: number;   biggestClimbDay: string;
    totalPoints: number;
    exactsTotal: number;
  };
  hasData: boolean;
};
```

`exactsTotal` vem do mesmo `applyScoreToEntry`, então "na mosca" bate com o número
do `SuaPosicaoCard`.

## UX

### Estados da página

| Estado | Gráfico | Cards | Tabela |
|---|---|---|---|
| Sem dados (`hasData=false`) | oculto | oculto | oculto → card de estado vazio |
| Um único dia | ponto isolado (dot) | normais | uma linha, `delta` neutro |
| Normal (N dias) | linha completa | normais | N linhas |

**Estado vazio:** card único com copy no espírito do `SuaPosicaoCard` — *"Seu
raio-x aparece quando os primeiros resultados saírem"*. Cobre pré-Copa e usuário
que ainda não pontuou.

### Componentes e UI

**`RankTimelineChart` — ilha `"use client"` (recharts v3)**

- `ResponsiveContainer` (largura 100%, altura fixa ~300px) → `LineChart`.
- **YAxis `reversed`**, `allowDecimals={false}`; domínio = **faixa de rank
  observada** do usuário (min/max com folga), **não** o campo inteiro — assim a
  subida/queda fica legível mesmo com muitos participantes. #1 no topo.
- **XAxis** = dias, tick formatado `dd/mm`; no mobile, afinar/pular ticks pra não
  amontoar.
- `Line` **linear** (sem curva "inventada"), com dots + activeDot; `CartesianGrid`
  horizontal sutil.
- **Tooltip custom:** Dia · Posição · Pontos do dia · Total · Variação (↑/↓).
- **Cores por token** (`hsl(var(--primary))`, `--border`, `--muted-foreground`)
  pra funcionar em dark/light via `next-themes` — nada hardcoded.

**`HighlightCards` — server, grid de `Card` (shadcn)**

- 5 cards: **Posição atual** (`#{rank} de {total}`), **Melhor posição** (+ data),
  **Maior subida num dia** (`+N`, + data), **Total de pontos**, **Na mosca** (ícone
  `Target`).
- Visual no estilo do `SuaPosicaoCard`: número grande `font-heading`, ícone
  lucide, label em `text-muted-foreground`, `tabular-nums`. Grid `grid-cols-2` no
  mobile → até `grid-cols-5` no desktop.

**`DailyTable` — server, `Table` (shadcn) no estilo do `RankingTable`**

- Colunas: **Dia** · **Jogos** · **Pts dia** · **Posição** · **Var.**
- **Var.** com seta colorida: ↑ verde (subiu), ↓ vermelho (caiu), – neutro (dia 1
  / sem mudança), reaproveitando a lógica de seta da lista de palpites simulada.
- Densidade mobile no padrão dos commits recentes (colunas apertadas,
  `tabular-nums`); "Jogos" pode recolher em telas bem pequenas.
- Ordem **mais recente no topo**.

**Página:** header (título "Raio-X" no padrão `font-heading uppercase`) →
`HighlightCards` → `RankTimelineChart` → `DailyTable`, com `max-w-7xl` como as
demais páginas.

### Navegação

- `auth-header.tsx`: adicionar `{ href: "/raio-x", label: "Raio-X" }` ao array
  `NAV` (cobre menu desktop e mobile de uma vez).
- `sua-posicao-card.tsx`: link "Ver meu raio-x" apontando para `/raio-x`.

## Casos de borda

- **Sem scores** (usuário sem palpites ou Copa sem resultados): `hasData=false` →
  estado vazio.
- **Empates de rank:** mesmos critérios de desempate do `ranking-core` (total →
  exatos → exatos mata-mata → winner_or_draw → final → semi/3º/final).
- **Dia 1:** `delta = 0` (sem "ontem"); seta neutra.
- **Partida adiada/cancelada:** sem `prediction_scores`, não entra no eixo — sem
  tratamento especial.
- **Bucketização:** jogo perto da meia-noite cai no dia São Paulo correto (fuso
  fixo UTC-3, como no `sao-paulo-day.ts`).

## Acessibilidade

- Gráfico com `aria-label` descritivo; a **tabela dia a dia** é a alternativa
  textual equivalente aos mesmos dados.
- Cards com número + label associados; ícones decorativos com `aria-hidden`.
- Seta de variação com `aria-label` ("subiu N posições" / "desceu N posições").
- Valores numéricos com `tabular-nums`.

## Testes

`raio-x-core.test.ts` (vitest, em `src/lib/scoring/__tests__/`, seguindo a cultura
do diretório):

- Reconstrução acumulada: pontos e rank corretos ao longo de N dias.
- Sinal do `delta` (subiu = positivo; caiu = negativo; dia 1 = 0).
- Empates resolvidos pelos mesmos critérios do `ranking-core`.
- `hasData=false` quando não há scores.
- Highlights: `bestRank`, `biggestClimb` e respectivas datas corretas.
- Bucketização por dia São Paulo (jogo perto da meia-noite no dia certo).

A ilha do recharts e as queries `server-only` **não** entram em teste unitário
(dependem de browser/Supabase); o valor de teste está no core puro.

## Decisões e trade-offs

- **Reconstrução sob demanda** (e não tabela de snapshot): fonte única de verdade
  nos `prediction_scores`, sem job/trigger por resultado. Custo O(dias × scores),
  trivial no porte do bolão; memoização por dia é o plano B se pesar.
- **recharts v3 (abordagem B escolhida):** tooltip e responsividade prontos,
  acelerando a entrega do gráfico interativo. Custo: dependência nova e ilha
  `"use client"` (JS no cliente), aceitos em troca de menos código de eixo/tooltip
  próprio.
- **Reuso do `ranking-core`:** o rank diário nunca diverge da Classificação
  oficial.
- **Domínio Y na faixa observada:** mantém a narrativa de subida/queda legível
  mesmo com muitos participantes.
- **Tabela como alternativa textual:** cobre acessibilidade do gráfico sem
  esforço extra, já que os dados são os mesmos.
