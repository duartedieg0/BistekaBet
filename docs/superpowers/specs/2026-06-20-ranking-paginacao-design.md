# Ranking · Soma incorreta por teto de linhas — Design

**Data:** 2026-06-20
**Depende de:** SP-02 (`prediction_scores` materializada), SP-03 (`loadRanking`/`aggregate`).
**Cláusulas cobertas:** §11 (classificação automática correta), §12 (totais corretos alimentam os critérios de desempate).

---

## 1. Objetivo

Corrigir a classificação, que exibe **pontos totais menores** que o valor real
materializado em `prediction_scores`. A causa não é o cálculo (a engine está
correta e testada) e sim a **leitura**: `loadRanking` busca `prediction_scores`
numa única query sem paginação, e o PostgREST do Supabase corta o resultado em
**1000 linhas** por padrão (`db-max-rows`). Com a tabela já em 1122 linhas, ~122
linhas ficam de fora — em ordem arbitrária de PK — e o `aggregate` soma a menos
para vários participantes.

O objetivo é fazer `loadRanking` ler **todas** as linhas de `prediction_scores`
via paginação, sem alterar a matemática de agregação/desempate.

### Evidência

- `select sum(points) from prediction_scores where user_id = '<id>'` → **61**.
- Tela (`/classificacao`, card de início) → **53**.
- `select count(*) from prediction_scores` → **1122** (> 1000).

## 2. Não-objetivos

- Mover a agregação/ordenação para o banco (RPC/view SQL) — é o caminho de
  escala futura (Opção B descartada agora por YAGNI; reimplementaria a contagem
  em SQL e exigiria nova migration).
- Subir `db-max-rows` no Supabase — remendo que volta a quebrar quando crescer.
- Qualquer mudança em `score.ts`, `ranking-core.ts` (`aggregate`,
  `compareForRanking`, `assignRanks`) ou na UI.
- Paginar a query de `profiles` — limitada pelo nº de participantes (dezenas),
  nunca chega perto de 1000.

## 3. Decisões de design

| ID | Decisão | Justificativa |
|---|---|---|
| Q1 | Paginar a leitura no cliente (não agregar no banco) | Defeito é "não lê todas as linhas"; a correção honesta é ler todas. Preserva a engine §6/§12 já testada; sem migration. Escala de bolão torna o custo de rede irrelevante. |
| Q2 | Helper genérico `paginateAll` em `src/lib/supabase/paginate.ts` | Laço de paginação é fácil de errar (off-by-one no range, condição de parada). Isolado e puro → unit-testável sem mockar Supabase, seguindo o split IO/puro do projeto (`ranking.ts` vs `ranking-core.ts`). Reutilizável por outras queries que venham a exceder o teto. |
| Q3 | `pageSize = 1000` (padrão do helper) | Casa com o teto do PostgREST: cada página vem cheia até a última. Parametrizável para testes. |
| Q4 | Ordenação estável obrigatória: `.order("prediction_id")` | Sem `ORDER BY` determinístico, offsets de `.range()` em páginas distintas podem repetir ou pular linhas. `prediction_id` é a PK (indexada) → estável e barato. |
| Q5 | Condição de parada: página com **menos** que `pageSize` linhas | Cobre o caso de total múltiplo exato de `pageSize` (a próxima página vem vazia, `0 < pageSize`, e encerra). Sem depender de um `count` separado. |

## 4. Arquitetura

### 4.1 Helper de paginação (`src/lib/supabase/paginate.ts`) — novo

Controle de laço puro, sem dependência do Supabase. Recebe um `fetchPage` que já
encapsula a query e o tratamento de erro (lança em caso de erro).

```ts
/**
 * Busca todas as linhas de uma fonte paginada por offset, contornando o teto
 * de `db-max-rows` (1000) do PostgREST. `fetchPage(from, to)` deve retornar a
 * página `[from, to]` inclusiva (lançando em caso de erro). Encerra quando uma
 * página retorna menos que `pageSize` linhas.
 */
export async function paginateAll<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await fetchPage(from, from + pageSize - 1);
    all.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
```

### 4.2 `loadRanking` paginado (`src/lib/scoring/ranking.ts`)

A query de `profiles` fica igual. A de `prediction_scores` passa a usar
`paginateAll`, com `fetchPage` fazendo `.order(...).range(from, to)` e lançando
em erro. O mapeamento `ScoreJoinRow → ScoreWithStageRow` e a chamada
`aggregate(profiles, scores)` permanecem idênticos.

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paginateAll } from "@/lib/supabase/paginate";
import {
  aggregate,
  type ProfileRow,
  type ScoreWithStageRow,
  type RankingRow,
} from "./ranking-core";

type ScoreJoinRow = {
  user_id: string;
  points: number;
  tier: string;
  matches: { stage: string } | { stage: string }[];
};

export async function loadRanking(): Promise<RankingRow[]> {
  const supabase = await createClient();

  const [profilesQ, scoreRows] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url, paid"),
    paginateAll<ScoreJoinRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("prediction_scores")
        .select("user_id, points, tier, matches!inner(stage)")
        .order("prediction_id", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as unknown as ScoreJoinRow[];
    }),
  ]);

  if (profilesQ.error) throw profilesQ.error;

  const profiles = (profilesQ.data ?? []) as ProfileRow[];
  const scores: ScoreWithStageRow[] = scoreRows.map((r) => {
    const m = Array.isArray(r.matches) ? r.matches[0] : r.matches;
    return {
      user_id: r.user_id,
      points: r.points,
      tier: r.tier as ScoreWithStageRow["tier"],
      stage: m.stage as ScoreWithStageRow["stage"],
    };
  });

  return aggregate(profiles, scores);
}
```

Notas:
- `prediction_id` está disponível para `.order()` mesmo sem aparecer no `select`
  (é coluna da própria tabela, PK).
- A query de `profiles` roda em paralelo com a paginação; seu erro continua
  sendo verificado via `profilesQ.error`.

### 4.3 Consumidores (sem mudança)

`loadRanking` é a fonte única de `/classificacao`, `<RankingPreview>` (card de
início) e `loadSuaPosicaoData`. Corrigir `loadRanking` conserta os três. O
`count: "exact", head: true` de `sua-posicao-queries.ts` é COUNT server-side e
**não** sofre o teto — permanece correto.

## 5. Estratégia de testes

### 5.1 `src/lib/supabase/__tests__/paginate.test.ts` — novo

Fetcher falso sobre um array em memória; `pageSize` pequeno (ex.: 10) para
exercitar múltiplas páginas sem alocar muito.

| Cenário | Cobre |
|---|---|
| 0 linhas → `[]`, 1 chamada | Caso vazio / parada imediata |
| linhas < pageSize (ex.: 7, page 10) → todas, 1 chamada | Página única curta |
| linhas não-múltiplas (ex.: 25, page 10) → todas as 25, 3 chamadas | Acúmulo entre páginas + parada na curta |
| linhas múltiplas exatas (ex.: 20, page 10) → todas as 20, 3 chamadas | Última página vazia encerra (sem repetir/pular) |
| ordem preservada | Concatena na ordem das páginas |

O fetcher de teste recebe `(from, to)` e retorna `data.slice(from, to + 1)`,
permitindo asserir nº de chamadas e os ranges pedidos.

### 5.2 Agregação

`ranking-core.test.ts` já cobre a matemática (§6/§12) e **não muda**.

### 5.3 Verificação manual (no plano)

Após o fix: comparar `sum(points)` por usuário no SQL editor com o total exibido
em `/classificacao` para ≥1 participante cujo total estava divergente (esperado:
passam a bater, ex.: 61 = 61).

## 6. Riscos e questões em aberto

1. **`db-max-rows` < 1000 no projeto** — se o Supabase estiver configurado com
   teto menor, `pageSize = 1000` pediria mais do que o servidor devolve e o laço
   pararia cedo (página < 1000) achando que acabou. Mitigação: manter `pageSize`
   ≤ teto efetivo. Default do Supabase é 1000; assumimos o default. Se necessário,
   reduzir `pageSize` (ex.: 500) é seguro e só muda o nº de round-trips.
2. **Tráfego de rede** — traz todas as linhas a cada render (1122 hoje, alguns
   milhares na final). Trivial na escala de um bolão; aceito conscientemente.
3. **Ordenação por PK** — `prediction_id` (uuid) não tem significado de negócio;
   serve só para estabilidade da paginação. Sem impacto na agregação (que soma
   tudo independentemente da ordem).
