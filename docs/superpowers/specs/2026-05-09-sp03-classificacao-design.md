# SP-03 · Classificação com Desempate — Design

**Data:** 2026-05-09
**Plano macro:** [`2026-05-09-plano-macro-regulamento.md`](./2026-05-09-plano-macro-regulamento.md)
**Depende de:** SP-01 (engine), SP-02 (`prediction_scores` materializada).
**Cláusulas cobertas:** §11 (classificação automática), §12 (todos os 6 critérios de desempate), apoio a §3, §13.

---

## 1. Objetivo

Exibir a classificação geral do bolão, com desempate completo conforme §12, em
duas superfícies:

- **`/inicio#ranking`** — top-10 abaixo da hero, link "ver classificação completa".
- **`/classificacao`** — rota dedicada com tabela completa.

A agregação e a ordenação são feitas em TS num Server Component, lendo
`prediction_scores ⨝ matches` e `profiles`. Sem novos objetos no banco além de
uma policy de leitura de `profiles`.

## 2. Não-objetivos

- "Meus palpites" com pontos por jogo — SP-04.
- Reabertura de palpites — SP-05.
- Premiação (cálculo do bolo, distribuição) — SP-07.
- Acesso público sem login (rota fica dentro de `(authenticated)`).
- Histórico/gráficos de evolução do ranking.
- Sorteio §12.6 dentro do app (decisão Q3-A).

## 3. Decisões de design

| ID | Decisão | Cláusula | Justificativa |
|---|---|---|---|
| Q1 | Todos os perfis aparecem; badge visual marca quem pagou | §2, §13 | Bolão social — vê todos competindo; premiação aplica regra fora do listing |
| Q2 | Agregação + ordenação em TS no Server Component | §11, §12 | Mantém policy de desempate junto da engine SP-01; testável em vitest; sem migration nova de objetos derivados |
| Q3 | Empates remanescentes (após §12.1–§12.5) ficam visualmente empatados; sem UI de sorteio | §12.6 | Sorteio é manual da organização; raro e não-bloqueante para SP-03 |
| Q4 | Top-10 em `/inicio#ranking` + página completa em `/classificacao`; ambas com colunas Padrão | — | Vitrine compacta + página dedicada; sem poluir o painel |
| Q5 | Colunas Padrão: `Rank · Nome · Pago? · Total · Exatos` | — | Suficiente para feedback de posição; detalhe completo de tiebreakers fica para futuro se houver demanda |
| Q6 | Header passa a apontar para `/classificacao` (sem manter `/inicio#ranking` no menu) | — | Item de menu mais óbvio; anchor ainda funciona como bookmark interno |
| Q7 | Nova policy de SELECT pública entre autenticados em `profiles` | §11 (UI precisa ler nomes/paid de todos) | Consistente com `prediction_scores` (SP-02 Q3); sem dados sensíveis em `profiles` |

## 4. Arquitetura

### 4.1 Migração `supabase/sql/009_profiles_public_read.sql`

```sql
-- BistekaBet — leitura pública de profiles entre autenticados (SP-03)
-- A classificação precisa exibir display_name, avatar_url e paid de todos.
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
```

A policy `profiles_select_own` continua existindo (mais restritiva), mas qualquer
política `select` permissiva já satisfaz o RLS — o efeito é "todos autenticados
leem todos os perfis". Não conflita com `profiles_admin_read_all`.

### 4.2 Tipos públicos (`src/lib/scoring/ranking-core.ts`)

```ts
import type { Stage } from "@/lib/types/match";
import type { Tier } from "@/lib/scoring";

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  paid: boolean;
};

export type ScoreWithStageRow = {
  user_id: string;
  points: number;
  tier: Tier;
  stage: Stage;
};

export type RankingEntry = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  paid: boolean;
  total_points: number;
  exacts_total: number;
  exacts_knockout: number;
  winner_or_draw_total: number;
  final_points: number;
  semi_third_final_points: number;
};

export type RankingRow = RankingEntry & { rank: number };

const KNOCKOUT_STAGES: ReadonlySet<Stage> = new Set([
  "round_of_32", "round_of_16", "quarter", "semi", "third_place", "final",
]);

const SEMI_THIRD_FINAL: ReadonlySet<Stage> = new Set([
  "semi", "third_place", "final",
]);
```

### 4.3 Comparador (§12)

```ts
export function compareForRanking(a: RankingEntry, b: RankingEntry): number {
  if (a.total_points !== b.total_points) return b.total_points - a.total_points;            // §11
  if (a.exacts_total !== b.exacts_total) return b.exacts_total - a.exacts_total;            // §12.1
  if (a.exacts_knockout !== b.exacts_knockout) return b.exacts_knockout - a.exacts_knockout; // §12.2
  if (a.winner_or_draw_total !== b.winner_or_draw_total)
    return b.winner_or_draw_total - a.winner_or_draw_total;                                  // §12.3
  if (a.final_points !== b.final_points) return b.final_points - a.final_points;             // §12.4
  if (a.semi_third_final_points !== b.semi_third_final_points)
    return b.semi_third_final_points - a.semi_third_final_points;                            // §12.5
  return 0;                                                                                  // §12.6 sorteio externo
}
```

### 4.4 Agregação pura

```ts
export function aggregate(
  profiles: ProfileRow[],
  scores: ScoreWithStageRow[],
): RankingRow[] {
  const init = new Map<string, RankingEntry>();
  for (const p of profiles) {
    init.set(p.id, {
      user_id: p.id,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      paid: p.paid,
      total_points: 0,
      exacts_total: 0,
      exacts_knockout: 0,
      winner_or_draw_total: 0,
      final_points: 0,
      semi_third_final_points: 0,
    });
  }

  for (const s of scores) {
    const entry = init.get(s.user_id);
    if (!entry) continue;

    entry.total_points += s.points;
    if (s.tier === "exact") {
      entry.exacts_total += 1;
      if (KNOCKOUT_STAGES.has(s.stage)) entry.exacts_knockout += 1;
    }
    if (s.tier !== "miss") entry.winner_or_draw_total += 1;
    if (s.stage === "final") entry.final_points += s.points;
    if (SEMI_THIRD_FINAL.has(s.stage)) entry.semi_third_final_points += s.points;
  }

  const sorted = [...init.values()].sort(compareForRanking);
  return assignRanks(sorted);
}

export function assignRanks(sorted: RankingEntry[]): RankingRow[] {
  const result: RankingRow[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const prev = result[i - 1];
    const tied =
      prev !== undefined && compareForRanking(sorted[i], sorted[i - 1]) === 0;
    result.push({ ...sorted[i], rank: tied ? prev.rank : i + 1 });
  }
  return result;
}
```

`assignRanks` produz `1, 2, 2, 4` (convenção esportiva). §3 (palpite ausente)
é resolvido por construção: usuários sem score começam com zeros.

### 4.5 I/O (`src/lib/scoring/ranking.ts`)

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { aggregate, type ProfileRow, type ScoreWithStageRow, type RankingRow } from "./ranking-core";

export async function loadRanking(): Promise<RankingRow[]> {
  const supabase = await createClient();

  const [profilesQ, scoresQ] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url, paid"),
    supabase.from("prediction_scores")
      .select("user_id, points, tier, matches!inner(stage)"),
  ]);

  if (profilesQ.error) throw profilesQ.error;
  if (scoresQ.error) throw scoresQ.error;

  const profiles = (profilesQ.data ?? []) as ProfileRow[];
  // matches!inner(stage) retorna { stage } embutido; precisamos achatar
  const scores = (scoresQ.data ?? []).map((r: { user_id: string; points: number; tier: string; matches: { stage: string } | { stage: string }[] }) => {
    const matches = Array.isArray(r.matches) ? r.matches[0] : r.matches;
    return {
      user_id: r.user_id,
      points: r.points,
      tier: r.tier,
      stage: matches.stage,
    };
  }) as ScoreWithStageRow[];

  return aggregate(profiles, scores);
}
```

> **Risco aberto:** se a sintaxe `matches!inner(stage)` não funcionar com o cliente
> JS atual, fallback é fazer dois reads (`matches` separado) e fazer o join em
> memória. Plano de implementação tem step de verificação.

### 4.6 UI

**`/classificacao/page.tsx`** (RSC):

- Carrega `loadRanking()`, renderiza `<RankingTable rows={rows} />` em layout `max-w-3xl`.
- Header: título + contador de participantes.

**`/inicio` ganha `<RankingPreview />`**:

- Carrega `loadRanking()`, mostra `slice(0, 10)`.
- Wrapper `<section id="ranking">` para anchor continuar funcionando.
- Link "Ver classificação completa →" para `/classificacao`.

**`<RankingTable>`** (componente compartilhado em `inicio/_components/`):

- Colunas Padrão: `# | Participante | Status | Pontos | Exatos`.
- `Status` usa shadcn `Badge`: `Pago` (default) vs `Pendente` (outline).
- Tabular números (`tabular-nums`) para alinhamento.

**Header/sidebar:**

- Trocar href `/inicio#ranking` → `/classificacao` em `app-sidebar.tsx` e `auth-header.tsx`.

### 4.7 Revalidação

Em pontos onde scores mudam, adicionar:

```ts
revalidatePath("/inicio");
revalidatePath("/classificacao");
```

Pontos de injeção:
- `updateMatch` (após `recomputeMatchScores`).
- `recomputeAllScores` (ao final).

## 5. Estratégia de testes

`src/lib/scoring/__tests__/ranking-core.test.ts`:

| Cenário | Cobre |
|---|---|
| Sem scores → todos zerados | §3, §11 |
| Pontuação distinta → ordem desc | §11 |
| Empate em total → mais exatos vence | §12.1 |
| Empate em §12.1 → mais exatos em knockout vence | §12.2 |
| Empate em §12.2 → mais V/E total vence | §12.3 |
| Empate em §12.3 → mais pontos na final vence | §12.4 |
| Empate em §12.4 → mais pontos em semi+3º+final vence | §12.5 |
| Empate em todos → ranks compartilhados (1, 2, 2, 4) | §12.6 + assignRanks |
| Score órfão (user sem profile) é ignorado | Defesa |
| `KNOCKOUT_STAGES` exclui `group` | §12 último parágrafo |

Total: 10 testes. `loadRanking()` (com I/O) verificado via E2E manual no plano.

## 6. Riscos e questões em aberto

1. **`matches!inner(stage)` syntax** — Supabase JS deve suportar via FK declarada. Step de verificação no plano. Fallback: dois reads.
2. **Componente `Avatar`** — não confirmado no projeto; SP-03 não usa avatar (apenas display_name). Se quisermos depois, é incremento simples.
3. **Caching SSR** — RSC sem `noStore()`; `revalidatePath` cobre os fluxos administrativos.
4. **Volume** — 30 usuários × 104 partidas = ~3000 rows. Trivial.
5. **Sorteio §12.6** — não tratado no app; documentado.

## 7. Como SP-04+ consomem

- **SP-04** (Meus palpites com pontos): mesma RLS pública de `prediction_scores` permite ao usuário ler os próprios scores. Reusa nada de SP-03 — é vista por usuário, não agregada.
- **SP-07** (Premiação): consome `loadRanking()` para identificar os 3 primeiros (com tratamento extra para §12.6 se houver empate na linha de corte).
