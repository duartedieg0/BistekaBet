# Brainstorm — Importar resultados de partidas via API-Football

## Contexto

BistekaBet é um bolão da Copa do Mundo 2026 (Next.js + Supabase). Hoje o admin atualiza placares **manualmente** em `/admin/partidas/[id]` (ver `src/app/(authenticated)/admin/partidas/_actions.ts::updateMatch`), digitando home_score, away_score, prorrogação e pênaltis. Após salvar, dispara `recomputeMatchScores(matchId)` que recalcula a pontuação de todos os palpites daquela partida.

A proposta é adicionar um **botão no admin** que importa resultados automaticamente da [API-Football v3](https://www.api-football.com/documentation-v3), reduzindo trabalho manual e risco de erro de digitação durante a Copa (104 partidas em ~30 dias).

## Estado atual relevante

- **Schema** (`supabase/sql/002_init_teams_matches.sql`):
  - `teams (id uuid, code text unique, name, flag_url, group_code)`
  - `matches (id uuid, stage, group_code, home_team_id, away_team_id, kickoff_at, status, home_score, away_score, home_score_et, away_score_et, home_pens, away_pens, winner_team_id)`
  - **Nenhum identificador externo** — sem `api_football_id` em teams/matches
- **RLS:** apenas admins escrevem em `matches`
- **Scoring:** `src/lib/scoring/recompute.ts` já é idempotente — pode ser chamado N vezes
- **Admin shell:** `src/app/(authenticated)/admin/_components/admin-shell.tsx` + cards em `_components/` (existe um `recompute-scores-card.tsx` que serve de referência de UX)

## O que a API-Football oferece

- `GET /fixtures?league={id}&season=2026` retorna todas as partidas da Copa numa chamada
- Filtros úteis: `date=YYYY-MM-DD`, `live=all`, `from`/`to`, `status=FT-AET-PEN`
- Campos retornados que mapeiam direto pro nosso schema:
  | API-Football | matches (nosso) |
  |---|---|
  | `goals.home` / `goals.away` | `home_score` / `away_score` |
  | `score.extratime.home/away` | `home_score_et` / `away_score_et` |
  | `score.penalty.home/away` | `home_pens` / `away_pens` |
  | `fixture.status.short` (FT/AET/PEN/PST/CANC) | derivar `status` + winner |
  | `teams.home.id` / `teams.away.id` | precisa mapping → `teams.api_football_id` |
- **Auth:** header `x-apisports-key`
- **Plano free:** 100 req/dia (folgado — 1 chamada/dia cobre tudo)

## Decisões em aberto (pra brainstormar)

### 1. Estratégia de matching (partida da API ↔ partida do banco)
- **(a) Adicionar `api_football_id` em teams e matches** — preciso uma migration nova + seed/backfill dos 48 times. Robusto pra sempre.
- **(b) Casar por `(home.code, away.code, date(kickoff_at))`** — zero migration, mas frágil se jogo for remarcado, código divergir ("USA" vs "US"), ou Copa tiver times com placeholders nas oitavas ("Vencedor Grupo A").
- **(c) Híbrido** — matching por código no primeiro import e gravar `api_football_id` cacheado.

### 2. Gatilho da sync
- **(a) Botão manual no admin** ("Importar resultados agora") — controle total, previsível, baixo consumo de quota.
- **(b) Cron** (Vercel Cron / Supabase pg_cron) a cada X minutos durante dias de jogo.
- **(c) Webhook** — API-Football não oferece push no plano free.
- **(d) Híbrido:** botão manual + cron opcional durante a Copa.

### 3. Granularidade do import
- **(a) Tudo de uma vez:** importa todas as fixtures finalizadas, atualiza só o que mudou (diff).
- **(b) Só partidas finalizadas hoje:** filtra por `date`.
- **(c) Por partida:** botão dentro do form de cada match.

### 4. UX do botão
- Onde fica? Card no dashboard do admin? Botão em `/admin/partidas`? Ambos?
- Feedback: toast com "X partidas atualizadas, Y inalteradas, Z com erro"?
- Confirmação antes de sobrescrever placares já preenchidos manualmente?
- Mostrar log/histórico da última sync (timestamp + diff)?

### 5. Tratamento de casos especiais
- **Partidas mata-mata sem times definidos** (placeholder "Vencedor A1"): pular ou tentar resolver?
- **Partida remarcada** (mudou `kickoff_at`): atualizar data também ou só placar?
- **Cancelada / postponed** (status PST/CANC): refletir no campo `status`?
- **Sobrescrever placar manual:** sempre, nunca, ou só se vazio?
- **Recompute de pontuação:** disparar `recomputeMatchScores` automaticamente pra cada partida que mudou.

### 6. Segredos e config
- `API_FOOTBALL_KEY` em env (server-side only, nunca `NEXT_PUBLIC_`)
- `API_FOOTBALL_LEAGUE_ID` e `API_FOOTBALL_SEASON` em env ou config
- Onde fazer fetch: Server Action vs Route Handler vs Edge Function

### 7. Observabilidade / segurança
- Logar cada import (quem, quando, quantas partidas afetadas)?
- Rate-limit no botão (não permitir spam — consome quota)?
- Erro da API: retry, fallback ou só mostrar pro admin?

## Riscos

- **Quota:** se um cron rodar agressivo, estoura free tier. Mitigação: cache + filtro por data.
- **Mapeamento incorreto:** seed errado de `api_football_id` corrompe placares. Mitigação: dry-run antes do commit + confirmação na UI.
- **Dependência externa em dia de final:** se API cair durante final da Copa, admin precisa do fallback manual (que já existe — então OK).
- **Drift do schema:** se API mudar campo `score.extratime`, import quebra silenciosamente. Mitigação: validar com Zod e logar mismatch.

## Sucesso = o quê?

- Admin clica 1 botão → todos placares finalizados do dia entram no banco → pontuação dos palpites recalculada → leaderboard atualizado.
- Tempo gasto pelo admin durante a Copa: de ~5min/jogo para ~10s/dia.
- Zero erro de digitação.

## Perguntas pro usuário antes de partir pro plano

1. Manual via botão é suficiente, ou já quer cron desde o início?
2. Topa a migration `api_football_id` (matching robusto) ou prefere começar com matching por código (zero migration)?
3. Sobrescrever placar já editado manualmente: sempre, nunca, ou perguntar?
4. Onde o botão deve viver: dashboard `/admin`, lista `/admin/partidas`, ou ambos?
