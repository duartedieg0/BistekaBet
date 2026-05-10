# Brainstorm: Tratamento de fuso horário (admin + usuário)

## Contexto
Bolão da Copa 2026. Público alvo: usuários no Brasil. Jogos da Copa acontecem em fusos diferentes (sedes EUA/México/Canadá), mas a referência de horário para o usuário final é **America/Sao_Paulo (BRT, UTC-03)**.

Hoje o app não trata timezone de forma consistente: depende do relógio do dispositivo em vários pontos, e há um provável bug de gravação no admin.

## Estado atual

### Banco
- Tabela `matches`, campos `kickoff_at` e `original_kickoff_at` do tipo `timestamptz` (`supabase/sql/002_init_teams_matches.sql:54`). OK — armazenamento é timezone-aware.

### Exibição (usuário)
- `palpites/_components/match-prediction-card.tsx:102-107` → `new Date(kickoff_at).toLocaleString("pt-BR")`
- `palpites/_components/rescheduled-badge.tsx:4-9` → idem
- `admin/partidas/_components/match-list.tsx:55` → idem
- Todos exibem no **fuso do dispositivo do usuário**. Usuário viajando, com relógio errado ou em outro fuso vê horário diferente do "oficial" do bolão.
- Existe `src/lib/dates/sao-paulo-day.ts` com `saoPauloDayRange()` forçando America/Sao_Paulo, mas é usado só para agrupamento por dia, não para exibir o horário do jogo.

### Edição (admin)
- `admin/partidas/_components/match-form.tsx:11-15` — `toLocalInput()` formata a partir de `getFullYear/getMonth/getDate/getHours/getMinutes` (fuso do navegador).
- Input `<input type="datetime-local">` opera no fuso local do navegador e envia string **sem offset** (ex.: `"2026-06-15T16:00"`).
- `admin/partidas/_actions.ts:15-37` — passa o valor cru direto pro Zod e pro Supabase no campo `timestamptz`.
- Postgres interpreta string naive usando o `TimeZone` da sessão. No Supabase, o default é **UTC**.
- **Bug provável:** admin digita "16:00" pensando em horário de Brasília, banco grava `16:00 UTC` = `13:00 BRT`. Diferença de 3h em todos os jogos cadastrados/editados pelo admin via formulário.
- Confirmar com `show timezone;` no Supabase antes de assumir.

### Validação de bloqueio de palpites
Três camadas, com fontes de relógio diferentes:
- **Client** (`match-prediction-card.tsx:20`): `new Date(kickoff_at).getTime() <= Date.now()` — relógio do dispositivo.
- **Server Action** (`palpites/_actions.ts:19-58`, `validateAgainstMatches`): `Date.now()` no Node (relógio do servidor Vercel).
- **RLS Policy** (`supabase/sql/006_init_predictions.sql:29-48`): `m.kickoff_at > now()` — relógio do Postgres.

A RLS é o único guard inviolável. Client com relógio adiantado/atrasado pode mostrar UX errada (botão liberado quando não deveria, ou bloqueado antes da hora) — mas a gravação fraudulenta é barrada pela RLS.

## Problemas a resolver

1. **Bug de gravação no admin** (mais crítico): horários inseridos pelo admin podem estar 3h adiantados no banco.
2. **Display inconsistente**: horário exibido depende do fuso do navegador. Usuário em Lisboa, Tóquio ou com fuso mal configurado vê outra coisa.
3. **Edição enviesada**: admin acessando de outro fuso vê e edita horário "errado" mesmo se o dado estiver correto no banco.
4. **Validação do bloqueio depende do relógio do dispositivo no client**: UX pode mentir (botão liberado/bloqueado fora da hora), embora a RLS proteja a gravação.
5. **Falta indicação visível** de que o horário mostrado é "horário de Brasília", o que confunde usuários em outros fusos.

## Pontos para o brainstorm

- Padronizar **toda exibição** de `kickoff_at` em `America/Sao_Paulo`, com sufixo claro (ex.: "16:00 (horário de Brasília)") — usar `Intl.DateTimeFormat` com `timeZone` ou `date-fns-tz` `formatInTimeZone`.
- No formulário do admin, **mostrar e editar** sempre em `America/Sao_Paulo`, independente do fuso do navegador. `toLocalInput` precisa virar `formatInTimeZone(iso, "America/Sao_Paulo", "yyyy-MM-dd'T'HH:mm")`.
- Na submissão do admin, converter a string naive do `datetime-local` para ISO UTC assumindo BRT antes de gravar — ex.: `zonedTimeToUtc(value, "America/Sao_Paulo").toISOString()`. Validar via Zod com `z.coerce.date()` ou regex + transform.
- **Migração de dados**: se o bug confirmado existe, corrigir registros já gravados (shift de -3h em `kickoff_at` e `original_kickoff_at` para partidas inseridas via admin antes do fix). Avaliar se há partidas cadastradas via seed/SQL que já estavam corretas — não shiftar essas.
- **Validação no client**: considerar buscar `select now()` do Postgres no carregamento da página de palpites e calcular `isClosed` a partir do skew servidor-cliente, em vez de `Date.now()` puro. Alternativa mais simples: confiar só na RLS e mostrar mensagem amigável quando ela falhar.
- **Server action `validateAgainstMatches`**: trocar `Date.now()` por `select now()` do Postgres para alinhar com a RLS, eliminando dependência do clock do runtime Node.
- **Decisão de produto**: quando o admin remarca um jogo, o `original_kickoff_at` exibido no badge para o usuário deve estar no mesmo fuso (BRT) — garantir consistência.
- **Biblioteca**: avaliar adicionar `date-fns-tz` (já tem `date-fns`?) vs. usar `Intl.DateTimeFormat` puro. Trade-off: bundle size vs. ergonomia para parse/format zoned.
- **i18n futuro**: se em algum momento o bolão atender usuários fora do Brasil, decidir agora se o horário "oficial" sempre será BRT (mais simples) ou se exibirá no fuso do usuário com indicação clara (mais flexível, mais complexo).

## Critérios de sucesso

- Admin vê e edita sempre em horário de Brasília, com label explícito.
- Banco grava o instante UTC correto, independente do fuso do navegador do admin.
- Usuário vê horário em Brasília com sufixo "(horário de Brasília)" em todas as telas.
- Bloqueio de palpite continua usando o relógio do Postgres como fonte de verdade.
- UX de bloqueio no client está sincronizada com o servidor (sem falsos liberados/bloqueados por skew).
- Dados existentes corrigidos via migração se necessário.
