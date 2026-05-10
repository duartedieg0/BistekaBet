# Componente "Avisos" + redesign de "Sua posição" na home /inicio

**Data:** 2026-05-10
**Escopo:** Substituir o card mockado "Aposta da rodada" por `AvisosCard` (pendências + status). Trocar o card lateral "Sua posição" (mockado com `#—`) por dados reais (rank do usuário + cravados). Os dois ocupam a coluna `1fr` da home.

## Contexto

A home `/inicio` foi originalmente toda mockada. O bloco "Seus próximos jogos" já foi redesenhado (spec `2026-05-09-inicio-proximos-jogos-design.md`). Restam dois cards laterais ainda mockados: "Sua posição" (`#—`) e "Aposta da rodada" (skeleton). Este spec cobre os dois.

A infra existe:
- `profiles.paid` (boolean) — status de pagamento por usuário (admin atualiza via toggle).
- `predictions` — palpites do usuário.
- `prediction_scores` — `(prediction_id, user_id, points, tier)` com `tier ∈ {"exact","winner_or_draw","miss"}`.
- `matches` — `kickoff_at`, `home_score`, `away_score`, `status`, `stage`.
- `loadRanking()` em `src/lib/scoring/ranking.ts` — array agregado já ordenado.
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
    homeLabel: string;
    awayLabel: string;
    homeCode: string;
    awayCode: string;
    kickoffAt: string; // ISO
  } | null;
  pendingPredictionsCount: number;
  awaitingResultsCount: number;
  pointsEarned: number;
  pointsPossible: number;
};
```

Implementação como `Promise.all` de queries paralelas:

1. **`paid`** — `select paid from profiles where id = userId`.
2. **`nextUnpredictedMatch`** — `select id, home_team(...), away_team(...), kickoff_at from matches left join predictions on (predictions.match_id = matches.id and predictions.user_id = userId) where kickoff_at > now and kickoff_at <= now + 24h and predictions.id is null order by kickoff_at asc limit 1`.
   Implementação prática (Supabase): buscar matches com `kickoff_at` no range, embutir `predictions!left(id)` filtrado por `predictions.user_id = userId`, e filtrar no JS por `prediction === null`. Pegar o primeiro.
3. **`pendingPredictionsCount`** — chamar `getInicioDayMatches(supabase, userId, now)` (já existe), contar `matches.filter(m => m.prediction === null).length`. Reuso evita duplicar lógica de "dia em SP / próximo dia com jogos".
4. **`awaitingResultsCount`** — predictions do user em matches já iniciados (`kickoff_at <= now`) que ainda não têm `prediction_scores` materializado.
   Query: `select count(*) from predictions p join matches m on m.id = p.match_id left join prediction_scores ps on ps.prediction_id = p.id where p.user_id = userId and m.kickoff_at <= now and ps.id is null`.
5. **`pointsEarned`** — `select coalesce(sum(points),0) from prediction_scores where user_id = userId`.
6. **`pointsPossible`** — `select stage, count(*) from matches where home_score is not null and away_score is not null and status = 'finished' group by stage`. Multiplicar cada stage por `POINTS_TABLE[stage].exact` e somar. Cálculo no JS, não em SQL.

> **Nota:** queries 5 e 6 podem ser combinadas em duas chamadas independentes; YAGNI dispensa otimização agora.

## `loadSuaPosicaoData(supabase, userId)`

Retorna:

```ts
type SuaPosicaoData = {
  rank: number | null;            // null se user não está no ranking (zero pts)
  totalPlayers: number;
  exactCount: number;
  totalPoints: number;             // útil pra exibir abaixo do "#12"
};
```

1. `loadRanking()` retorna `RankingRow[]` ordenado. Encontrar `row.user_id === userId`. Se encontrado, `rank = index + 1, totalPoints = row.total`. Se não, `rank = null`.
2. `totalPlayers = ranking.length` (apenas quem aparece no aggregate; alinhar com `/classificacao`).
3. `exactCount` = `select count(*) from prediction_scores where user_id = userId and tier = 'exact'`.

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
- Link discreto: "Como pagar?" → `/regulamento#pagamento` (anchor a ser adicionado ao regulamento se ainda não existir; se não, link vai pra `/regulamento` sem fragment).

### `NextMatchCountdown` (client)
- Recebe `match: { homeCode, awayCode, kickoffAt }` (string ISO).
- `useEffect` + `setInterval(1000)` calculando `kickoffAt - Date.now()`.
- Renderiza inicial no SSR com `formatDuration(kickoffAt - Date.now())` (server time); ao montar no client, o intervalo recalcula. Pequena divergência aceitável.
- Formato: `02:43:17` quando >1h; `43:17` quando <1h. Quando `<= 0` (jogo começou): aviso some na próxima query (não precisa lidar especificamente além de não negativo).
- Texto auxiliar: `BRA × ARG · você ainda não palpitou`.

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

  const { rank, totalPlayers, exactCount } = await loadSuaPosicaoData(supabase, userData.user.id);

  return (
    <Card>
      <CardHeader><CardTitle>...Sua posição...</CardTitle></CardHeader>
      <CardContent>
        <span className="font-heading text-6xl text-primary tabular leading-none">
          {rank !== null ? `#${rank}` : "#—"}
        </span>
        {rank !== null ? (
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
- `PaymentWarning` usa `role="status"`.
- Countdown: o número absoluto deve estar no DOM (não só visualmente animado), com `aria-live="polite"` para anunciar mudança grosseira (sem ler 1s a 1s — usar atualização sob demanda do leitor).
- Cores não são o único indicador (sempre há ícone + texto).

## Testes

- Unit do helper de pontos possíveis: dado `[{stage:"group",count:3},{stage:"final",count:1}]` e `POINTS_TABLE`, somar correto.
- Unit de `formatCountdown(ms)`: cobre `>1h`, `<1h`, `<1min`, `<= 0`.
- Componente `NextMatchCountdown`: renderiza valor inicial; após `vi.advanceTimersByTime(1000)`, o tempo decresce.
- Componente `PointsProgress`: renderiza `0%` para `earned=0/possible=10`, `100%` para `earned=10/possible=10`.

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
