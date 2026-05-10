# Componente "Avisos" + redesign de "Sua posição" na home /inicio

**Data:** 2026-05-10
**Escopo:** Substituir o card mockado "Aposta da rodada" por `AvisosCard` (pendências + status). Trocar o card lateral "Sua posição" (mockado com `#—`) por dados reais (rank do usuário + cravados). Os dois ocupam a coluna `1fr` da home.

## Contexto

A home `/inicio` foi originalmente toda mockada. O bloco "Seus próximos jogos" já foi redesenhado (spec `2026-05-09-inicio-proximos-jogos-design.md`). Restam dois cards laterais ainda mockados: "Sua posição" (`#—`) e "Aposta da rodada" (skeleton). Este spec cobre os dois.

A infra existe:
- `profiles.paid` (boolean) — status de pagamento por usuário (admin atualiza via toggle).
- `predictions` — palpites do usuário.
- `prediction_scores` — `(prediction_id, user_id, points, tier)` com `tier ∈ {"exact","winner_or_draw","miss"}`.
- `matches` — `kickoff_at`, `home_score`, `away_score`, `status`, `stage`. **`status` é nullable e admite apenas `"postponed" | "cancelled"`**; "finalizado" é derivado (não há valor `'finished'`): um match está finalizado quando `home_score` e `away_score` são não-nulos E `status` é null/`'rescheduled'` (i.e., não foi cancelado/adiado).
- `loadRanking()` em `src/lib/scoring/ranking.ts` — retorna `RankingRow[]` já ordenado e com **`row.rank`** (com tratamento de empate via `assignRanks`) e **`row.total_points`**. Inclui **todos os profiles** (mesmo zerados), portanto sempre encontrará o usuário autenticado.
- `POINTS_TABLE` em `src/lib/scoring/points-table.ts` — pontos máximos (`exact`) por stage.
- `getInicioDayMatches()` em `_lib/queries.ts` — matches do dia em SP (com fallback para próximo dia com jogos).

## Decisões da conversa

- "Mudança de ranking" foi descartada (exige snapshot diário inexistente).
- "Pontos ganhos" e "Aguardando resultado oficial" são dois avisos separados (não fundir).
- "Na mosca" sai dos Avisos e vira stat dentro do card "Sua posição".
- Card "Sua posição" sai do mock junto com Avisos.
- Empty state: literal `Tudo em dia`.
- Sem dismissal / sem persistência: avisos somem quando a condição se resolve.
- Prioridade dentro de Atenção: **pagamento → countdown → palpites pendentes**.
- Janela de "Palpites pendentes" = mesma do bloco "Próximos jogos" (próximo dia com jogos).
- Countdown <24h: somente o jogo mais próximo, com relógio vivo (atualiza por segundo).
- "Pontos possíveis" Y = soma de `POINTS_TABLE[stage].exact` para **todos** os matches finalizados, independentemente de o usuário ter palpitado.
- Pontos ganhos: total acumulado (não janela).
- Visual de Pontos ganhos: porcentagem grande + total pequeno.
- Sobreposição (2)+(3) é aceita: o jogo mais próximo <24h também conta no contador panorâmico.

## Arquitetura

```
src/app/(authenticated)/inicio/
  _components/
    avisos-card.tsx               # server: orquestra loadAvisosData + render
    avisos/
      payment-warning.tsx         # server
      next-match-countdown.tsx    # client (setInterval)
      pending-predictions.tsx     # server
      awaiting-results.tsx        # server
      points-progress.tsx         # server
      tudo-em-dia.tsx             # server (empty state)
    sua-posicao-card.tsx          # server
  _lib/
    avisos-queries.ts             # loadAvisosData(supabase, userId, now)
    sua-posicao-queries.ts        # loadSuaPosicaoData(supabase, userId)
```

`page.tsx` substitui inline:
- `<Card>...Sua posição...</Card>` → `<SuaPosicaoCard />`
- `<Card>...Aposta da rodada...</Card>` → `<AvisosCard />`

Tudo o mais (header, grid `2fr_1fr`, `UpcomingMatchesSection`, `RankingPreview`) intocado.

## `loadAvisosData(supabase, userId, now)`

Retorna:

```ts
type AvisosData = {
  paid: boolean;
  nextUnpredictedMatch: {
    id: string;
    homeCode: string;
    awayCode: string;
    kickoffAt: string; // ISO 8601
  } | null;
  pendingPredictionsCount: number;
  awaitingResultsCount: number;
  pointsEarned: number;
  pointsPossible: number;
};
```

Implementação: `Promise.all` com 6 queries independentes resolvidas em paralelo (sem combinar — manter cada uma legível).

1. **`paid`** — `select paid from profiles where id = userId`.
2. **`nextUnpredictedMatch`** — buscar o próximo match nas próximas 24h em que o user não palpitou.
   - Range: `kickoff_at > now AND kickoff_at <= now + 24h`.
   - Supabase: `from("matches").select("id, home_team(...), away_team(...), kickoff_at, predictions!left(id)").eq("predictions.user_id", userId).gt("kickoff_at", now).lte("kickoff_at", now+24h).order("kickoff_at", asc).limit(N)`.
   - No JS: filtrar `prediction === null`, pegar o primeiro. (`limit(N)` com folga porque o filtro JS pode descartar matches onde o user já palpitou.)
3. **`pendingPredictionsCount`** — chamar `getInicioDayMatches(supabase, userId, now)`. Função retorna `DayMatchesResult = { matches, referenceDate, isToday }`; usar `result.matches.filter(m => m.prediction === null).length`. Reuso evita duplicar lógica de "dia em SP / próximo dia com jogos".
4. **`awaitingResultsCount`** — predictions do user em matches já iniciados (`kickoff_at <= now`) que ainda não têm `prediction_scores` materializado.
   - SQL conceitual: `select count(*) from predictions p join matches m on m.id = p.match_id left join prediction_scores ps on ps.prediction_id = p.id where p.user_id = userId and m.kickoff_at <= now and ps.id is null`.
   - Supabase: `from("predictions").select("id, prediction_scores!left(id), matches!inner(kickoff_at)", { count:"exact", head:true }).eq("user_id", userId).is("prediction_scores.id", null).lte("matches.kickoff_at", now)`.
5. **`pointsEarned`** — `select coalesce(sum(points),0) from prediction_scores where user_id = userId`. Sem RPC: buscar `select points` filtrado e somar no JS.
6. **`pointsPossible`** — soma de `POINTS_TABLE[stage].exact` para todos os matches **finalizados**.
   - Predicado de finalizado: `home_score IS NOT NULL AND away_score IS NOT NULL AND (status IS NULL OR status NOT IN ('postponed','cancelled'))`.
   - Supabase: `from("matches").select("stage, status, home_score, away_score")`, filtrar no JS pelo predicado acima, depois `groupBy(stage)` e somar `count(stage) * POINTS_TABLE[stage].exact`.
   - Helper isolado: `computePointsPossible(matches: { stage: Stage }[]): number` em `_lib/avisos-queries.ts` — usado pelos testes unitários.

## `loadSuaPosicaoData(userId)`

Retorna:

```ts
type SuaPosicaoData = {
  rank: number;                    // sempre presente (loadRanking inclui todos profiles)
  totalPlayers: number;            // total de profiles no ranking agregado
  totalPoints: number;
  exactCount: number;
};
```

1. `loadRanking()` (server-only, cria seu próprio Supabase client) retorna `RankingRow[]` já com `rank` e `total_points` calculados (`assignRanks` no `ranking-core.ts` trata empates). Achar `row.user_id === userId`; usar `row.rank` e `row.total_points` direto. **Não recalcular como `index + 1`** — quebraria empates.
2. `totalPlayers = ranking.length`. (Como `aggregate()` inclui todos os profiles, isso equivale ao total de participantes do bolão.)
3. `exactCount`: query separada — `select count(*) from prediction_scores where user_id = userId and tier = 'exact'`.

Empty state visual: como o usuário sempre está no ranking, o trigger é `totalPoints === 0` (não `rank === null`) — ainda não palpitou ou nenhum palpite foi pontuado.

> **Nota:** `loadRanking()` cria seu próprio Supabase client; este helper não recebe `supabase` como parâmetro para evitar confusão. Aceita-se a sobreposição de clients (já é o padrão do projeto em `/classificacao`).

## `AvisosCard` (server)

```tsx
export async function AvisosCard() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const data = await loadAvisosData(supabase, userData.user.id, new Date());

  const hasAttention = !data.paid || data.nextUnpredictedMatch !== null || data.pendingPredictionsCount > 0;
  const hasInfo = data.awaitingResultsCount > 0 || data.pointsPossible > 0;

  return (
    <Card>
      <CardHeader>...título "Avisos"...</CardHeader>
      <CardContent>
        <SectionAttention>
          {!data.paid && <PaymentWarning />}
          {data.nextUnpredictedMatch && <NextMatchCountdown match={data.nextUnpredictedMatch} />}
          {data.pendingPredictionsCount > 0 && <PendingPredictions count={data.pendingPredictionsCount} />}
          {!hasAttention && <TudoEmDia />}
        </SectionAttention>
        {hasInfo && (
          <SectionInfo>
            {data.awaitingResultsCount > 0 && <AwaitingResults count={data.awaitingResultsCount} />}
            {data.pointsPossible > 0 && <PointsProgress earned={data.pointsEarned} possible={data.pointsPossible} />}
          </SectionInfo>
        )}
      </CardContent>
    </Card>
  );
}
```

`SectionAttention` e `SectionInfo` podem ser fragments com label uppercase no topo (`"Atenção"`/`"Informação"`); não precisam virar componentes próprios.

## Cada aviso

### `PaymentWarning`
- Ícone: `AlertCircle` (lucide), cor warning.
- Texto: "Pagamento pendente · sua inscrição precisa ser confirmada".
- Link discreto: "Como pagar?" → `/regulamento`. (Não inventar anchor; deixar a navegação em `/regulamento` natural.)
- A11y: container com `role="alert"` (não `role="status"` — é um warning persistente, não um update de estado).

### `NextMatchCountdown` (client)
- Recebe `match: { homeCode, awayCode, kickoffAt }` (string ISO).
- Estratégia de hidratação: renderiza placeholder estático (`--:--:--`) no SSR; após `useEffect` no mount, computa `kickoffAt - Date.now()` e inicia `setInterval(1000)`. Evita warning de hydration mismatch sem `suppressHydrationWarning`.
- `formatCountdown(ms: number): string` — helper isolado em `_lib/avisos-queries.ts` (ou arquivo próprio se preferir):
  - `>= 1h` → `HH:MM:SS` (ex: `02:43:17`)
  - `< 1h` e `>= 0` → `MM:SS` (ex: `43:17`)
  - `< 0` (jogo já começou) → retorna `"00:00"` e o componente sai na próxima query natural; não precisa redirecionar.
- Texto auxiliar: `{homeCode} × {awayCode} · você ainda não palpitou` (códigos curtos, ex: `BRA × ARG`). Quando o slot ainda for TBD (knockout sem time definido), `nextUnpredictedMatch` provavelmente nem será retornado, pois o palpite está atrelado a um match cujo confronto ainda não está fechado — janela de 24h normalmente cobre só fase de grupos/oitavas com ambos os times definidos. Se cair um TBD aqui, mostrar `"TBD × TBD"` é aceitável (edge case raro).

### `PendingPredictions`
- Texto: `{count} palpite{s} pendente{s} para os próximos jogos`.
- CTA: link "Palpitar agora" → `/palpites`.

### `AwaitingResults`
- Texto: `{count} jogo{s} aguardando resultado oficial`.

### `PointsProgress`
- Layout: `{percent}%` em `font-heading` grande + `{earned} de {possible} pts possíveis` abaixo em texto secundário.
- `percent = Math.round(earned / possible * 100)`. Se `possible === 0`, omitir o componente (estado pré-Copa).

### `TudoEmDia`
- Ícone: `CheckCircle2`, cor success/primary.
- Texto: "Tudo em dia · você não tem pendências".

## `SuaPosicaoCard` (server)

```tsx
export async function SuaPosicaoCard() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const { rank, totalPlayers, totalPoints, exactCount } = await loadSuaPosicaoData(userData.user.id);
  const hasPalpitado = totalPoints > 0;

  return (
    <Card>
      <CardHeader><CardTitle>...Sua posição...</CardTitle></CardHeader>
      <CardContent>
        <span className="font-heading text-6xl text-primary tabular leading-none">
          {hasPalpitado ? `#${rank}` : "#—"}
        </span>
        {hasPalpitado ? (
          <span className="text-sm text-muted-foreground">
            de {totalPlayers} · {exactCount} cravado{exactCount === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            Você ainda não palpitou. Comece pela primeira partida para entrar no ranking.
          </span>
        )}
      </CardContent>
    </Card>
  );
}
```

Mesmo Trophy icon e estilos do mock atual.

## Render & SSR

- Todos os componentes são server exceto `NextMatchCountdown`.
- `NextMatchCountdown` recebe `kickoffAt: string` (ISO). Server-render mostra valor calculado uma vez; `useEffect` no client inicia `setInterval`. Não há hydration mismatch porque o valor inicial é determinístico (calculado a partir de `kickoffAt`, que é o mesmo no server e no client) e o intervalo só inicia após mount.
- `loadAvisosData` e `loadSuaPosicaoData` são chamados em paralelo (cada card fetcha o seu) — duas chamadas independentes a `createClient()`. Aceitável; YAGNI quanto a consolidar.

## Performance

- `loadRanking()` agrega scores em memória; já é o padrão usado em `/classificacao` e `RankingPreview`. Sem cache atual; aceito por enquanto.
- `loadAvisosData` faz ~5 queries paralelas. Latência total ≈ max query, não soma.

## Acessibilidade

- Cada aviso tem ícone com `aria-hidden` e texto significativo.
- `PaymentWarning` usa `role="alert"`.
- Countdown: o número absoluto deve estar no DOM (não só visualmente animado), com `aria-live="polite"` para anunciar mudança grosseira (sem ler 1s a 1s — usar atualização sob demanda do leitor).
- Cores não são o único indicador (sempre há ícone + texto).

## Testes

- Unit de `computePointsPossible(matches)` em `_lib/avisos-queries.ts`: dado mistura de stages (ex: 3 group + 1 final) e o `POINTS_TABLE` real, somar `3 * POINTS_TABLE.group.exact + 1 * POINTS_TABLE.final.exact`.
- Unit de `formatCountdown(ms)`: cobre `>= 1h` → `HH:MM:SS`; `< 1h` → `MM:SS`; `< 0` → `"00:00"`.
- Componente `NextMatchCountdown`: SSR mostra `--:--:--`; após mount + `vi.advanceTimersByTime(1000)`, exibe valor formatado e decresce em ticks subsequentes.
- Componente `PointsProgress`: renderiza `0%` para `earned=0/possible=10`, `100%` para `earned=10/possible=10`. Quando `possible === 0`, NÃO renderiza (retorna `null`).

## Fora de escopo

- Persistência de "lido" / dismissal.
- Notificações push / e-mail.
- Edição de pagamento pelo próprio usuário.
- Snapshot diário de ranking (e portanto, o aviso "Mudança de ranking").
- Cache server-side de `loadRanking()`.

## Riscos

- **Sobreposição (2)+(3)** — aceita; usuário decidiu. Risco: pode parecer redundante se o único pendente for o jogo do countdown. Mitigação visual: estilizar diferente (countdown destacado, contador panorâmico discreto).
- **Divergência server vs client no countdown** — server usa `Date.now()` no momento do render; cliente usa `Date.now()` no momento do mount. Diferença típica é o tempo de transmissão (centenas de ms). Aceitável; o tick de 1s alinha logo.
- **`pointsPossible` quando `POINTS_TABLE` mudar** — fórmula assume `POINTS_TABLE[stage].exact` é o pontuação máxima por stage. Se a tabela ganhar bônus condicionais ou stages novos, atualizar o helper. Comentário no código a documentar isso.
- **`loadRanking` custosa** — toda visita à home recalcula. Não está em escopo otimizar agora; observar.
