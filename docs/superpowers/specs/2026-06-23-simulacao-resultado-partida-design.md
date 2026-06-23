# Simulação de resultado na página da partida — Design

## Contexto

Na página `/partidas/[matchId]`, quando a partida já começou mas ainda está
**aguardando resultado oficial**, o usuário hoje só vê os palpites de todos os
participantes — sem qualquer noção de "e se o jogo terminasse assim?". Queremos
permitir que ele **simule** um placar e veja, na própria lista, quantos pontos
cada participante ganharia nesse jogo e como ficaria a **classificação geral**
do bolão com esse resultado hipotético.

A simulação é puramente local e descartável: nada é persistido, nada altera dado
oficial, e ela some ao limpar.

## Escopo

- A simulação só é oferecida no estado **"Aguardando resultado oficial"**:
  `kickoff_at <= now` (já garantido pela rota), `home_score`/`away_score` nulos e
  `status` diferente de `cancelled`/`postponed`.
- Um painel **"Simular resultado"** com dois campos numéricos (mandante /
  visitante) e os botões **Simular** e **Limpar**.
- Ao simular, a lista de palpites reflete o resultado hipotético:
  - nova coluna **Pts** com os pontos **desta partida** de cada participante;
  - nova coluna **Total** com o total de pontos do participante **no bolão
    inteiro**, já incluindo a simulação;
  - a coluna **#** (rank) reflete a **classificação geral recalculada**, com a
    seção "com palpite" **reordenada** pelo rank simulado e uma **seta ↑/↓**
    indicando a variação de posição frente ao rank atual.
- **Limpar** volta a lista ao estado normal.

### Fora de escopo

- Persistir simulações, compartilhar via URL, ou sincronizar entre usuários.
- Simular prorrogação/pênaltis. A pontuação usa apenas o placar do tempo normal
  (`home_score`/`away_score`), então a simulação também.
- Botões de placar rápido (atalhos pré-definidos).
- Qualquer mudança no estado "resultado oficial" ou "cancelada/adiada".

## UX

### Estados da página

| Estado | Pts | Total | Reordena + setas | Painel de simulação |
|---|---|---|---|---|
| Resultado oficial | oficial desta partida | — (oculta) | não (lista estática) | oculto |
| Aguardando, sem simular | — (oculta) | — (oculta) | não | visível |
| Aguardando, **simulando** | simulado desta partida | total + simulação | sim | visível (+ Limpar) |

A coluna **Pts** aparece quando há **resultado oficial** OU **simulação ativa**.
A coluna **Total** aparece **apenas durante a simulação**. Ambas são numéricas,
alinhadas à direita, com `tabular-nums`.

### Painel "Simular resultado"

- Renderizado entre o cabeçalho e a lista, somente quando a partida está
  aguardando resultado **e** existe ao menos um palpite (sem palpites não há o
  que refletir, então o painel é omitido).
- Dois campos numéricos rotulados (mandante / visitante).
- Botão **Simular**: desabilitado enquanto os dois campos não tiverem valor
  inteiro válido (≥ 0, faixa 0–99). Ao clicar, aplica a simulação.
- Botão **Limpar**: visível quando há simulação ativa; remove o resultado
  simulado e volta a lista ao estado normal.
- O painel deixa explícito que o resultado é hipotético; nada nele altera dado
  oficial.

### Lista com simulação ativa

- Colunas: **#** (com seta ↑/↓) · Participante · Palpite · **Pts** · **Total**.
- **Pts**: pontos desta partida (resultado de `score()` com o placar simulado).
- **Total**: total do participante no bolão já somado à simulação.
- **Seta de variação**: ao lado do número do rank, `↑N` (verde) ou `↓N`
  (vermelho) com quantas posições subiu/desceu vs. o rank atual; sem mudança →
  traço/ausência.
- **Reordenação**: a seção "com palpite" é reordenada pelo rank simulado.
- **Seção "Sem palpite" (colapsada)**: esses participantes não pontuam nesta
  partida, mas o rank deles pode mudar porque outros ganham pontos. Mostram o
  novo rank + seta + **Total** (inalterado pela simulação), mas **sem** valor em
  **Pts** (mantém "—", pois não houve palpite).
- **Busca**: continua funcionando, filtrando sobre a lista já reordenada.

### Edge cases

- **Resultado oficial / cancelada / adiada**: `canSimulate` é `false` → painel
  não aparece; comportamento atual intacto.
- **Ninguém palpitou**: painel omitido; lista principal segue com a mensagem
  atual "Ninguém palpitou neste jogo".
- **Campos inválidos/vazios**: botão **Simular** inerte; nada aplica.
- **Re-simular**: clicar **Simular** com outro placar recalcula a simulação.
- **Empates de rank na simulação**: resolvidos pela mesma regra do oficial
  (`compareForRanking` / `assignRanks`).

## Arquitetura

### Abordagem

Recálculo **no cliente**, reaproveitando as funções puras já testadas do motor
de ranking e pontuação. A página já carrega o `ranking` completo (com todos os
campos de desempate) e os palpites; basta enviá-los ao cliente. Ao "Simular",
uma função pura roda no navegador — sem ida ao servidor, instantânea. A
simulação é puramente aditiva (esta partida ainda não tem linha em
`prediction_scores`), então não há risco de contagem dupla.

### Estrutura de arquivos

```
src/lib/scoring/
  ranking-core.ts                  # editado: extrair applyScoreToEntry (helper puro)
  simulate.ts                      # novo: simulateMatchRanking (função pura)
  __tests__/
    simulate.test.ts               # novo

src/app/(authenticated)/partidas/[matchId]/
  page.tsx                         # editado: calcula canSimulate, passa stage
  _lib/
    get-match-predictions.ts       # editado: anexa campos de pontuação às linhas
    join-prediction-rows.ts        # editado: embute RankingEntry na linha
  _components/
    match-simulator.tsx            # novo: Client wrapper, dono do estado da simulação
    simulation-controls.tsx        # novo: campos numéricos + Simular/Limpar
    predictions-list.tsx           # editado: props de simulação, reordenação, colunas, header
    prediction-row.tsx             # editado: colunas Pts/Total + seta de variação
    no-prediction-section.tsx      # editado: repassa simulação (rank/seta/Total) às linhas
```

Todos os pontos são **inteiros** — `score()` devolve pontos inteiros e os totais
são somas de inteiros. Pts e Total não precisam de formatação decimal.

Durante a simulação, o **cabeçalho** da lista ("com palpite") passa a exibir os
rótulos das novas colunas (**Pts** e **Total**), além do já existente. Hoje o
header só renderiza "Pts" condicionalmente (`showPoints`); a mesma lógica se
estende para incluir "Total" quando simulando.

Os campos do painel são rotulados pelos **nomes dos times** (mandante /
visitante), reaproveitando os dados já disponíveis em `MatchHeader`.

### Helper compartilhado (refator de apoio)

Hoje `aggregate()` em `ranking-core.ts` acumula, para cada score, os pontos e os
campos de desempate (`exacts_total`, `exacts_knockout`, `winner_or_draw_total`,
`final_points`, `semi_third_final_points`). Extrair esse trecho para um helper
puro:

```ts
export function applyScoreToEntry(
  entry: RankingEntry,
  input: { points: number; tier: Tier; stage: Stage },
): void;
```

`aggregate()` passa a usá-lo, e a simulação usa o mesmo helper — garantindo que o
rank simulado segue **exatamente** a regra do oficial, sem divergência.

### Função pura de simulação

`src/lib/scoring/simulate.ts`:

```ts
export type SimulatedRow = {
  points: number | null;   // pontos desta partida (null = não palpitou)
  tier: Tier | null;
  total: number;           // total no bolão já com a simulação
  rank: number;            // rank simulado
  delta: number;           // rankAtual - rankSimulado (positivo = subiu)
};

export function simulateMatchRanking(input: {
  entries: RankingRow[];                              // standing atual (com rank e tiebreakers)
  predictions: Map<string, { home: number; away: number }>;
  result: { home: number; away: number };
  stage: Stage;
}): Map<string, SimulatedRow>;
```

Para cada entry:
1. Se o usuário palpitou → `score({ prediction, match: result, stage })` dá
   `{ points, tier }`. Clona o entry e aplica `applyScoreToEntry`.
2. Se não palpitou → entry inalterado; `points`/`tier` = `null`; ainda participa
   do reranqueamento.

Depois: ordena todos os entries clonados com `compareForRanking`, reranqueia com
`assignRanks`. Para cada usuário: `rank` = novo rank, `total` = `total_points` do
entry simulado, `delta` = `rankAtual − rankSimulado`.

### Camada de dados

`join-prediction-rows.ts` já itera sobre `RankingRow[]`. Embutir na linha os
campos de pontuação necessários ao recálculo (o `RankingEntry` de origem), para
que cada `MatchPredictionRow` seja auto-suficiente — tanto para renderizar quanto
para alimentar o recálculo no cliente:

```ts
type MatchPredictionRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  rank: number;
  prediction: { home_score: number; away_score: number } | null;
  score: PredictionScore | null;
  entry: RankingEntry;     // novo: campos de pontuação atuais (total + desempates)
};
```

`get-match-predictions.ts` não muda a busca; apenas propaga o `entry`. `page.tsx`
calcula `canSimulate` e passa `match.stage` ao componente cliente.

### Componentes (cliente)

- **`MatchSimulator`** — wrapper Client Component. Dono do estado
  `simulatedResult: { home, away } | null`. Constrói o mapa de palpites a partir
  das linhas, roda `simulateMatchRanking` ao aplicar e repassa o `Map<userId,
  SimulatedRow>` (ou `null`) para a lista. Renderiza `SimulationControls` +
  `PredictionsList`.
- **`SimulationControls`** — campos numéricos + botões; emite
  `onApply(result)` / `onClear()`. Validação local (inteiros 0–99).
- **`PredictionsList`** — mantém o estado de busca; ganha props opcionais
  `simulation: Map<string, SimulatedRow> | null` e `simulating: boolean`. Quando
  simulando, reordena a seção "com palpite" por `rank` simulado e exibe as
  colunas Pts/Total.
- **`PredictionRow`** — apresentacional; renderiza Pts/Total e a seta de variação
  conforme as props.

### Fluxo de dados

```
page.tsx (server) ── canSimulate, stage, rows(+entry) ──▶ MatchSimulator (estado)
  └─ ao "Simular": simulateMatchRanking(...) ─▶ Map<userId, SimulatedRow>
       └─▶ PredictionsList ─▶ reordena + colunas Pts/Total + setas
  └─ ao "Limpar": estado = null ─▶ lista volta ao normal
```

## Acessibilidade

- Campos numéricos com `label` associado (mandante / visitante).
- Botões **Simular**/**Limpar** com texto claro; **Simular** com `disabled`
  quando inválido.
- Coluna **Pts**/**Total** com `tabular-nums` e `aria-label` ("X pontos" / "total
  Y pontos").
- Seta de variação com `aria-label` ("subiu N posições" / "desceu N posições").

## Testes

- `simulate.test.ts` (função pura):
  - placar exato bumpa os campos de desempate e os pontos corretos por estágio;
  - participante sobe/desce de posição conforme os pontos ganhos;
  - empates de rank resolvidos pela regra oficial;
  - fase de grupos vs. mata-mata (tabela de pontos e `exacts_knockout`);
  - final/semi alimentam `final_points` / `semi_third_final_points`;
  - quem não palpitou recebe `points: null`, `total` inalterado, mas `rank`/`delta`
    podem mudar;
  - simulação é aditiva (não duplica pontos de partidas já pontuadas).
- `ranking-core.test.ts`: continua passando após extrair `applyScoreToEntry`
  (regressão — o `aggregate` oficial não muda de comportamento).
- Sem testes de componente pesados; segue o padrão do repo (lógica pura em
  `_lib`/`scoring` é o que se testa).

## Decisões e trade-offs

- **Recálculo no cliente** (e não server action): a conta é pura e já temos os
  dados; evita round-trip por simulação e mantém a interação instantânea. Custa
  enviar os campos de pontuação de todos os participantes ao cliente — aceitável,
  pois o ranking já é um leaderboard essencialmente público e o bolão tem porte
  modesto.
- **Helper `applyScoreToEntry` compartilhado**: fonte única da regra de
  acumulação; o rank simulado nunca diverge do oficial.
- **Coluna Total só na simulação**: mantém a lista enxuta no estado normal; o
  total ganha relevância justamente quando há um "e se?" para comparar.
- **Reordenar + seta**: a lista vira a classificação simulada, e a seta torna
  legível o impacto do resultado na posição de cada um.
- **Sem persistência/URL**: simulação é exploratória e efêmera; persistir
  adicionaria complexidade sem valor claro nesta etapa (YAGNI).
