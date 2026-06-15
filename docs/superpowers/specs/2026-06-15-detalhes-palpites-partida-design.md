# Detalhes de palpites por partida — Design

## Contexto

Hoje, ao olhar um card de partida em `/palpites` ou `/inicio`, o usuário só enxerga o próprio palpite e o resultado oficial (quando disponível). Não há forma de ver o que os outros participantes apostaram. Queremos, depois que a partida começa, permitir que qualquer usuário visualize todos os palpites daquele jogo.

## Escopo

- Quando uma partida já começou (`kickoff_at <= now`), está aguardando resultado ou já tem resultado, expor um botão **"Ver palpites"** no card.
- O botão leva a uma página dedicada `/partidas/[matchId]` que lista todos os usuários elegíveis, ordenados pelo ranking geral, com nome, palpite e pontos do jogo (quando há resultado).
- Usuários elegíveis que não palpitaram aparecem em uma sub-seção colapsada "Sem palpite (N)".
- A página tem busca por nome (filtro client-side).
- A mesma experiência é herdada automaticamente em `/inicio`, pois aquela tela já reusa `MatchPredictionCard`.

### Fora de escopo

- Mostrar coluna de classificação ("quem avança") para mata-mata.
- Exportar CSV, compartilhar link com prévia, comentários, paginação, realtime.

## UX

### Gatilho no card

No `MatchPredictionCard` (já existente), quando `kickoff_at <= now`, exibir no header — ao lado do badge "Encerrado/Aguardando resultado" — um link/botão pequeno com ícone `Users` e label "Ver palpites". Clicar navega para `/partidas/[matchId]`. O botão tem `aria-label` que inclui os nomes dos times para leitores de tela.

### Página `/partidas/[matchId]`

- **Cabeçalho**: link "← Voltar", data/hora do jogo, estágio (grupo/oitavas/etc.), times com bandeiras (reaproveitando componentes existentes) e o resultado oficial — ou um dos rótulos: "Aguardando resultado oficial", "Cancelada", "Adiada".
- **Barra de busca** (sticky abaixo do cabeçalho): input com placeholder "Buscar por nome…". Filtro client-side, case/accent-insensitive.
- **Lista de palpites**: linhas compactas com `posição no ranking · avatar/iniciais · nome · palpite (ex.: 2 × 1) · pontos do jogo`. Ordenada por posição no ranking geral (asc). Pontos só aparecem quando há resultado oficial.
- **Sem palpite**: usuários elegíveis que não palpitaram aparecem ao final em uma sub-seção colapsada por padrão chamada "Sem palpite (N)", ordenada pelo ranking geral.
- **Mobile-first**: linhas compactas; palpite e pontos alinhados à direita com `tabular-nums`. Resultado oficial visível no topo o tempo todo.

### Edge cases

- Partida não iniciada (`kickoff_at > now`): rota responde `notFound()`. O botão no card só aparece após o início, mas o acesso direto também precisa validar.
- Partida inexistente: `notFound()`.
- Cancelada/adiada: a página existe; lista mostra palpites, mas sem coluna de pontos. Aviso no cabeçalho.
- Ninguém palpitou: lista principal vazia com mensagem "Ninguém palpitou neste jogo"; "Sem palpite (N)" segue normalmente.
- Busca sem resultados: "Nenhum usuário encontrado".

## Arquitetura

### Estrutura de arquivos

```
src/app/(authenticated)/partidas/
  [matchId]/
    page.tsx                          # Server Component, busca dados e renderiza
    loading.tsx                       # skeleton simples
    _components/
      match-header.tsx                # cabeçalho com times, data, resultado oficial
      predictions-list.tsx            # Client Component: busca + lista filtrável
      prediction-row.tsx              # linha (posição, nome, palpite, pontos)
      no-prediction-section.tsx       # bloco colapsável "Sem palpite (N)"
  _lib/
    get-match-predictions.ts          # query única + agregação
    search-filter.ts                  # função pura de filtro por nome (testável)

src/app/(authenticated)/palpites/_components/
  match-prediction-card.tsx           # editado: link "Ver palpites" no header
```

### Componentes

- `page.tsx` — Server Component. Resolve `matchId`, faz I/O e passa dados prontos.
- `MatchHeader` — Server Component (apenas renderização).
- `PredictionsList` — único Client Component, responsável pelo estado do filtro de busca e pelo toggle da seção "Sem palpite".
- `PredictionRow` / `NoPredictionSection` — apresentacionais.

### Camada de dados

`get-match-predictions.ts` expõe uma função única:

```ts
type MatchPredictionRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  rank: number;
  prediction: { home_score: number; away_score: number } | null;
  score: PredictionScore | null;
};

type MatchDetailData = {
  match: MatchWithTeams;
  predictions: MatchPredictionRow[];
};

export async function getMatchPredictions(matchId: string): Promise<MatchDetailData | null>;
```

Carregamento (em paralelo via `Promise.all`):

1. `loadRanking()` — já existe; devolve `RankingRow[]` ordenado com `rank` calculado. Reusado para evitar duplicar a lógica de desempate e o critério de elegibilidade.
2. `matches` com `home_team`/`away_team` via select aninhado (`.eq("id", matchId).single()`).
3. `predictions` daquela partida (`select("user_id, home_score, away_score").eq("match_id", matchId)`).
4. `prediction_scores` daquela partida (`select("user_id, points, tier").eq("match_id", matchId)`) — vazio quando não há resultado.

Depois, em memória, percorre `RankingRow[]` (já ordenado) e faz join com mapas `predictionByUser` / `scoreByUser` por `user_id` para montar `MatchPredictionRow[]`. Universo de usuários = usuários do ranking (mantém um único lugar para a regra de elegibilidade).

A busca por nome é client-side, sobre a lista já carregada — feita pela função pura `search-filter.ts`.

## Acessibilidade

- Input de busca com `aria-label="Buscar usuário por nome"`.
- Linhas como itens de lista (`<ul>` / `<li>`).
- Pontos com `tabular-nums` e `aria-label="X pontos"`.
- Botão "Ver palpites" no card com `aria-label` incluindo os nomes dos times.

## Testes

- `get-match-predictions.test.ts`:
  - ordena por `rank` asc;
  - "Sem palpite" preserva ordem do ranking;
  - quando não há `prediction_scores`, `score` é `null` em todas as linhas;
  - usuários fora do ranking não aparecem.
- `search-filter.test.ts`:
  - case-insensitive e accent-insensitive;
  - string vazia devolve a lista íntegra.
- Sem E2E novo; o fluxo do card já é coberto pelos testes existentes.

## Decisões e trade-offs

- **Rota `/partidas/[matchId]`** (e não `/palpites/[matchId]`): a página é "uma partida e seus palpites", acessada tanto de `/inicio` quanto de `/palpites`. Rota neutra evita confundir com a área "Meus palpites".
- **Reuso de `loadRanking`**: garante elegibilidade e ordenação coerentes com `/classificacao`. Custa carregar o ranking inteiro a cada visita, o que é aceitável dado o tamanho esperado do bolão.
- **Busca client-side**: simples, instantânea, evita roundtrips. Lista cabe confortavelmente em memória.
- **`notFound()` antes do kickoff**: previne vazamento de palpites mesmo via URL direta — fonte única de verdade da regra de visibilidade.
