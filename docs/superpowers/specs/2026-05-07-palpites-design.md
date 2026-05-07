# Página de Palpites — Design

**Data:** 2026-05-07
**Escopo:** Nova página `/palpites` (acessível via menu header) onde o usuário visualiza todos os jogos da Copa 2026 e registra seus palpites. Esta primeira versão **não inclui pontuação** (scoring) — apenas coleta.

## Decisões de produto

| Tema | Decisão |
|---|---|
| Tipo de palpite (grupo) | Placar exato (gols home / gols away) |
| Tipo de palpite (mata-mata) | Placar do tempo normal + classificado caso empate; sem prorrogação/pênaltis |
| Prazo para palpitar | Até o `kickoff_at` de cada jogo individualmente |
| Mata-mata com times TBD | Permitir palpite com placeholders (ex: "1º Grupo A vs 2º Grupo B") |
| Pontuação | **Fora do escopo desta entrega** |
| Layout | Tabs por fase; dentro de "Grupos", subagrupado por Grupo A–L |
| UX de envio | Botão "Salvar" por jogo + botão "Salvar palpites" em lote por grupo/fase |

## Schema do banco

Nova migration: `supabase/sql/006_init_predictions.sql`

```sql
create table public.predictions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  match_id         uuid not null references public.matches(id) on delete cascade,
  home_score       int  not null check (home_score >= 0),
  away_score       int  not null check (away_score >= 0),
  advances_team_id uuid references public.teams(id) on delete restrict,
  advances_slot    text check (advances_slot in ('home','away')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, match_id)
);

create index predictions_user_idx  on public.predictions (user_id);
create index predictions_match_idx on public.predictions (match_id);

create trigger predictions_set_updated_at
  before update on public.predictions
  for each row execute function public.set_updated_at();

alter table public.predictions enable row level security;

create policy "predictions_select_own" on public.predictions
  for select to authenticated using (user_id = auth.uid());

create policy "predictions_insert_own_before_kickoff" on public.predictions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.kickoff_at > now()
    )
  );

create policy "predictions_update_own_before_kickoff" on public.predictions
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.kickoff_at > now()
    )
  );
```

**Notas:**
- `advances_team_id` e `advances_slot` são alternativas: `advances_team_id` quando os times do mata-mata já existem; `advances_slot` ('home' ou 'away') quando ainda são TBD. A server action escolhe um dos dois.
- A regra "knockout com empate exige `advances_*`" é validada na server action, não em SQL — mantém schema flexível e simplifica.
- RLS oferece defesa em profundidade contra gravação após o kickoff.

## Estrutura de arquivos

```
src/app/(authenticated)/palpites/
├── page.tsx                          # Server Component — fetch + agrupamento
├── _components/
│   ├── stage-tabs.tsx                # Client — tabs por fase
│   ├── group-section.tsx             # Server — grupo A–L com lista + botão "Salvar grupo"
│   ├── knockout-section.tsx          # Server — fase de mata-mata
│   ├── match-prediction-card.tsx     # Client — card de um jogo: form local
│   └── group-save-form.tsx           # Client — coordena submit em lote
├── _actions/
│   ├── save-prediction.ts            # Server action — salva 1 palpite (upsert)
│   └── save-predictions-batch.ts     # Server action — salva N palpites (lote)
└── _lib/
    └── queries.ts                    # Helpers Supabase
```

**Modificações em arquivos existentes:**
- `src/app/(authenticated)/_components/auth-header.tsx`: adicionar `{ href: "/palpites", label: "Palpites" }` no array `NAV` (após "Início").
- Novo `src/lib/types/prediction.ts`: tipos `Prediction`, `MatchWithPrediction`.

**Hierarquia:**

```
PalpitesPage (server)
└── StageTabs (client)
    ├── [stage=group] → GroupSection × 12 (A..L)
    │                   └── GroupSaveForm (client)
    │                       └── MatchPredictionCard × 6
    └── [stage=knockout] → KnockoutSection
                           └── MatchPredictionCard × N
```

## Fluxo de dados

### Fetch inicial (`page.tsx`)
1. Server component obtém `user_id` da sessão Supabase.
2. Query única: `matches` left join `predictions` (filtrado por `user_id = auth.uid()` via RLS).
3. Agrupa em memória:
   ```ts
   {
     group: { A: Match[], B: Match[], ..., L: Match[] },
     round_of_32: Match[],
     round_of_16: Match[],
     quarter: Match[],
     semi: Match[],
     third_place: Match[],
     final: Match[],
   }
   ```
4. Cada match traz `prediction: Prediction | null` anexado.

### Server action `savePrediction(input)`
- **Input:** `{ matchId, homeScore, awayScore, advancesTeamId?, advancesSlot? }`
- **Validação Zod:**
  - `homeScore`/`awayScore`: inteiros >= 0
  - Para mata-mata: se `homeScore === awayScore`, exige `advancesTeamId` OU `advancesSlot`
  - Para grupo: ignora `advances_*`
- Carrega match para verificar `stage` e `kickoff_at > now()` (defesa em profundidade).
- `upsert` em `predictions` por `(user_id, match_id)`.
- `revalidatePath('/palpites')`.
- Retorna `{ ok: true } | { ok: false, error: string }`.

### Server action `savePredictionsBatch(inputs)`
- **Input:** array de `savePrediction` inputs.
- **Política:** all-or-nothing — se um falha, nada é salvo; retorna lista de erros por `matchId`.
- Um único `upsert` em lote.
- `revalidatePath('/palpites')`.

### Estado client (`MatchPredictionCard`)
- `useState` local: `homeScore`, `awayScore`, `advancesSlot`/`advancesTeamId`.
- Flag `dirty`: true se diferente do palpite salvo.
- Submit individual chama `savePrediction`; toast via `sonner`.
- Card expõe estado ao `GroupSaveForm` via ref/context — botão "Salvar palpites do grupo" coleta apenas cards `dirty` não-encerrados e chama `savePredictionsBatch`.

### Jogos com kickoff passado
- Card renderiza inputs em readonly + badge "Encerrado".
- Botão "Salvar grupo" ignora cards encerrados.

### Mata-mata TBD (sem times definidos)
- Quando `home_team_id`/`away_team_id` é null, card mostra label gerado a partir de `bracket_position` (ex: "1º Grupo A", "Vencedor R32-1").
- Inputs de placar funcionam normalmente.
- Em caso de empate, em vez de seletor de time, dois radios: "Avança lado esquerdo" / "Avança lado direito" → grava `advances_slot`.

## UI

### `MatchPredictionCard`
- Layout horizontal: `[bandeira home] [nome home] [input] X [input] [nome away] [bandeira away]`.
- TBD: substitui bandeira+nome por chip cinza com label do bracket.
- Empate em mata-mata expande seção: "Quem se classifica?" com radios (times reais ou slots TBD).
- Botão "Salvar" inline; muda para "Salvando..." durante pending; check verde por 2s após sucesso.
- Estado vazio = inputs sem valor; salvo = inputs preenchidos + badge "Salvo".
- Encerrado: tom esmaecido, badge "Encerrado", inputs disabled.

### `GroupSection` / `GroupSaveForm`
- Header: "Grupo A" + contador "3/6 palpites".
- Botão "Salvar palpites do grupo" — só ativo se houver ≥1 card dirty e não-encerrado.

### `StageTabs`
- Reusa padrão de `src/app/(authenticated)/admin/partidas/_components/stage-tabs.tsx`.
- Tab inicial: primeira fase com jogos não-encerrados; fallback "Grupos".

## Error handling

| Cenário | Comportamento |
|---|---|
| Server action retorna erro | Toast destrutivo com mensagem |
| RLS bloqueia (kickoff passou durante request) | Toast "Esse jogo já começou. Atualizando..." + revalidate |
| Erro de rede | Toast "Falha ao salvar. Tente novamente." |
| Placar negativo / não-inteiro | Erro inline no campo (validação client) |

## Acessibilidade

- Inputs com `aria-label` (ex: "Gols Brasil", "Gols Argentina").
- Radios de "quem avança" em `<fieldset>` com `<legend>`.
- Foco visível garantido pelo design system existente.

## Loading e estados vazios

- Página é Server Component → sem skeleton inicial.
- Sem jogos cadastrados → empty state "Nenhum jogo disponível ainda".

## Validação manual (cenários a verificar)

Não há suíte de testes no projeto. Para esta feature, validar manualmente:

1. **Salvar palpite de jogo de grupo** — inputs vazios → 2x1 → clicar Salvar → toast verde, badge "Salvo" aparece.
2. **Editar palpite existente** — recarregar página → palpite anterior aparece preenchido → alterar → salvar → atualiza.
3. **Salvar em lote por grupo** — preencher 3 jogos do Grupo A → clicar "Salvar palpites do grupo" → todos salvam atomicamente.
4. **Lote com erro** — forçar erro em 1 jogo → nenhum dos 3 é salvo → toast com erros listados.
5. **Kickoff passado** — alterar `kickoff_at` de um jogo para o passado → card aparece encerrado, inputs disabled.
6. **Empate em mata-mata (times definidos)** — digitar 1x1 → seção "Quem se classifica?" expande com nomes dos times → escolher → salvar.
7. **Mata-mata TBD** — card mostra "1º Grupo A vs 2º Grupo B" → digitar 2x1 → salvar → palpite gravado com `advances_team_id = null`.
8. **TBD com empate** — digitar 1x1 em jogo TBD → radios "Avança lado esquerdo/direito" aparecem → escolher → salva `advances_slot`.
9. **RLS** — em outra sessão, tentar `select * from predictions` de outro usuário → retorna vazio.
10. **Menu header** — link "Palpites" aparece após "Início" → clica → navega.

## Fora do escopo

- Pontuação (scoring) por palpite.
- Visualização de palpites de outros usuários / ranking.
- Histórico de edições.
- Notificações de prazo se aproximando.
- Predição de prorrogação e pênaltis no mata-mata.
