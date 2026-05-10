# Tratamento de fuso horário (BRT) — design

**Data:** 2026-05-10
**Status:** Aprovado para planejamento
**Escopo:** Padronizar exibição, edição e validação de horários de partida em `America/Sao_Paulo`, corrigir bug de gravação no admin e alinhar a validação da server action ao relógio do Postgres.

## Contexto

BistekaBet é um bolão da Copa 2026 com público no Brasil. O horário "oficial" de toda partida é horário de Brasília (BRT, UTC-3 fixo — Brasil sem horário de verão desde 2019). Hoje:

- `matches.kickoff_at` e `matches.original_kickoff_at` são `timestamptz`. Armazenamento OK.
- Toda exibição usa `new Date(iso).toLocaleString("pt-BR")` — depende do fuso do dispositivo.
- O formulário do admin (`<input type="datetime-local">`) lê e escreve no fuso do navegador. A action passa a string naive direto ao Supabase, que interpreta no `TimeZone` da sessão (default UTC). **Bug provável: jogos editados via admin ficam 3h adiantados no banco.**
- A validação de bloqueio de palpite tem três camadas com relógios diferentes: client (`Date.now()`), server action (`Date.now()` no Node/Vercel), RLS (`now()` do Postgres). Apenas a RLS é inviolável.

Brainstorm de origem: `brainstorm-timezone.md`.

## Decisões

1. **BRT é o fuso oficial, hardcoded.** Sem suporte a per-user TZ. Se mudar de ideia, parametrizar é trivial depois.
2. **Sem dependência nova.** Usar `Intl.DateTimeFormat` + aritmética manual (offset BRT = -03 fixo). Estende o padrão já em `src/lib/dates/sao-paulo-day.ts`.
3. **Sem mudança visual.** UI dos cards continua mostrando `"15/06 16:00"` sem sufixo "(Brasília)". A correção é interna: o horário deixa de depender do fuso do dispositivo.
4. **Client mantém `Date.now()` para `isClosed`.** RLS protege a gravação, toast amigável já existe (`"Esse jogo já começou."`). Edge case de relógio dessincronizado não justifica fetch extra por page load.
5. **Server action passa a usar `now()` do Postgres** em vez de `Date.now()` do Node. Elimina dependência do clock do runtime Vercel e alinha com a RLS.

## Arquitetura

### Módulo central: `src/lib/dates/sao-paulo.ts`

Renomeação de `sao-paulo-day.ts` (o módulo deixa de ser só sobre "day"). Atualizar imports.

API exportada:

```ts
const TZ = "America/Sao_Paulo";

// Mantidos:
saoPauloDayRange(ref?: Date): { startUtc: Date; endUtc: Date }
formatSaoPauloDayLabel(date: Date, opts?: { isToday?: boolean }): string

// Novos:
formatKickoff(iso: string): string
// Ex.: "15/06 16:00". Usa Intl.DateTimeFormat com timeZone: TZ.

toSaoPauloInputValue(iso: string): string
// Ex.: "2026-06-15T16:00". Para <input type="datetime-local">.

fromSaoPauloInputValue(value: string): string
// Recebe "2026-06-15T16:00" (naive, assumido BRT). Retorna ISO UTC.
// Implementação: parse + new Date(Date.UTC(y, m-1, d, h+3, min)).toISOString().
```

Tudo `Intl` + aritmética. Sem dependência nova.

### Função SQL: `server_now`

`supabase/sql/00X_server_now.sql`:

```sql
create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$ select now(); $$;
```

Exposta via PostgREST. Usada pela server action.

## Mudanças por arquivo

### Admin (correção do bug de gravação)

- `src/app/(authenticated)/admin/partidas/_components/match-form.tsx`
  - Substituir `toLocalInput()` por `toSaoPauloInputValue(iso)`. Input passa a mostrar sempre BRT, independente de onde o admin acessa.
- `src/app/(authenticated)/admin/partidas/_actions.ts`
  - Antes do Zod/Supabase, converter `kickoff_at` (string naive `YYYY-MM-DDTHH:mm`) com `fromSaoPauloInputValue`.
  - Mesma conversão em `original_kickoff_at` quando presente.
  - Schema Zod: aceita `YYYY-MM-DDTHH:mm` e transforma com `fromSaoPauloInputValue`.
- `src/app/(authenticated)/admin/partidas/_components/match-list.tsx`
  - Trocar `toLocaleString("pt-BR")` (linha ~55) por `formatKickoff(iso)`.

### Display do usuário

- `src/app/(authenticated)/palpites/_components/match-prediction-card.tsx`
  - Linhas 102-107: `formatKickoff(match.kickoff_at)`.
  - Linha 20 (`isClosed`): mantém `new Date(...).getTime() <= Date.now()`. `kickoff_at` é instante UTC; comparação é correta sem TZ.
- `src/app/(authenticated)/palpites/_components/rescheduled-badge.tsx`
  - `formatKickoff(originalKickoff)`.

### Server action (validação de bloqueio)

- `src/app/(authenticated)/palpites/_actions.ts` — `validateAgainstMatches`
  - Substituir `const now = Date.now()` por chamada `supabase.rpc("server_now")` e usar o valor retornado.
  - Se `rpc` falhar, retornar erro propagado (não fazer fallback silencioso pra `Date.now()` — a RLS pega no pior caso).

## Testes

`src/lib/dates/sao-paulo.test.ts` (vitest):

- `formatKickoff("2026-06-15T19:00:00Z")` → `"15/06 16:00"`.
- `toSaoPauloInputValue("2026-06-15T19:00:00Z")` → `"2026-06-15T16:00"`.
- `fromSaoPauloInputValue("2026-06-15T16:00")` → `"2026-06-15T19:00:00.000Z"`.
- Round-trip: `fromSaoPauloInputValue(toSaoPauloInputValue(iso)) === iso` em vários horários.
- Borda: `fromSaoPauloInputValue("2026-06-15T00:30")` → `"2026-06-15T03:30:00.000Z"` (mantém o dia).
- Borda: virada de dia BRT (23:00 BRT = 02:00 UTC do dia seguinte).

Server action (se houver setup de teste para actions): mockar `supabase.rpc("server_now")` retornando timestamp fixo e validar que kickoff < now retorna `"Esse jogo já começou."`.

## Plano de migração de dados (manual)

Antes de mexer no código:

1. SQL Editor do Supabase:
   - `show timezone;` (esperado: UTC).
   - `select id, home_team_id, away_team_id, kickoff_at, original_kickoff_at, created_at from matches order by created_at desc limit 20;`
2. Comparar com horários esperados em BRT. O seed `004_seed_matches_group_stage.sql` insere com offset explícito `+00`, então esses 72 registros estão corretos. Apenas registros editados/inseridos pelo admin via formulário podem estar errados.
3. Se houver registros afetados:
   ```sql
   update matches
   set kickoff_at = kickoff_at - interval '3 hours',
       original_kickoff_at = case
         when original_kickoff_at is not null
         then original_kickoff_at - interval '3 hours'
         else null
       end
   where id in ('...');
   ```
4. Se admin nunca editou nada: pular esta etapa.

## Critérios de sucesso

- Admin vê e edita sempre em horário de Brasília, mesmo acessando de outro fuso.
- Banco grava o instante UTC correto, independente do fuso do navegador do admin.
- Usuário vê o mesmo horário em qualquer lugar do mundo (fixo BRT).
- Server action e RLS usam o mesmo relógio (Postgres `now()`).
- Bug de gravação no admin corrigido daqui pra frente; dados existentes corrigidos pontualmente se necessário.
- Testes unitários cobrem o módulo `sao-paulo.ts` em casos de borda.

## Fora de escopo

- Suporte a fusos por usuário.
- Indicação visual "(horário de Brasília)" na UI.
- Adicionar `date-fns`/`date-fns-tz`.
- Buscar `now()` do Postgres no client para corrigir skew do dispositivo.
- Realtime/tick para atualizar `isClosed` durante a sessão.

## Ordem de implementação

1. Renomear `sao-paulo-day.ts` → `sao-paulo.ts`, adicionar `formatKickoff` / `toSaoPauloInputValue` / `fromSaoPauloInputValue`. Testes unitários.
2. Criar função SQL `server_now` (`supabase/sql/00X_server_now.sql`).
3. `validateAgainstMatches` passa a usar `server_now` via RPC.
4. Admin: `match-form.tsx`, `_actions.ts` e `match-list.tsx` passam a usar o novo módulo.
5. Cards do usuário: `match-prediction-card.tsx` e `rescheduled-badge.tsx` passam a usar `formatKickoff`.
6. Verificação manual do banco; shift pontual via SQL se necessário.
