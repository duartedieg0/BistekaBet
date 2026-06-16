# Toggle de lembrete por WhatsApp na home — Design

## Contexto

Existe um workflow n8n (`n8n/workflows/lembrete-15min-kickoff.json`) que roda a cada 5 minutos, busca alvos via RPC `list_pending_predict_reminders_15m` e envia mensagem WhatsApp para usuários que ainda não palpitaram em partidas com kickoff em ~15 minutos. Hoje o opt-in é implícito (todo usuário com `whatsapp` preenchido vira alvo). Queremos permitir que o usuário desligue esse lembrete por conta própria.

## Escopo

- Adicionar campo booleano `notify_whatsapp` em `public.profiles`, default `true` (opt-in por padrão; cobre tanto novos quanto usuários atuais via default em `ALTER TABLE`).
- Adicionar toggle na home (`/inicio`), logo abaixo do título do card "Próximos jogos", que alterna o valor.
- Atualizar a RPC `list_pending_predict_reminders_15m` para filtrar `notify_whatsapp = true`, fazendo com que o workflow respeite o opt-out.

### Fora de escopo

- Página de perfil/settings com o mesmo toggle (não existe superfície ainda).
- Toast educativo na primeira mudança.
- Granularidade por tipo de lembrete (ficamos com um booleano genérico).
- Tipos de notificação além de `predict_15m`.

## UX

### Toggle na home

Renderizado dentro do `<CardHeader>` do card "Próximos jogos" em `upcoming-matches-section.tsx`, abaixo do `<CardTitle>`. Sempre visível (independente de haver jogos próximos).

Layout:

```
[ícone] Próximos jogos
─────────────────────────
[ícone] Lembrete por WhatsApp                 [Switch]
```

- Ícone: `MessageCircle` do lucide-react (mesmo padrão do resto do app — sem SVG custom).
- Label: "Lembrete por WhatsApp".
- Controle: `<Switch>` do shadcn.

### Comportamento

- Save otimista: ao alternar, o estado local responde imediatamente e a Server Action persiste em background.
- Sucesso: silencioso — o próprio toggle responder visualmente é feedback suficiente.
- Falha: reverte o estado local e emite `toast.error("Não foi possível salvar")` via sonner.
- Em transição (Server Action em voo), o `<Switch>` segue interativo — `useTransition` apenas controla o revert em caso de erro.

### Edge cases

- Usuário sem `whatsapp` preenchido: situação inalcançável na prática — o `WhatsappRequiredModal` no `(authenticated)/layout.tsx` força a coleta antes do primeiro uso autenticado. Sem tratamento especial.
- Cliques rápidos sucessivos: cada chamada da Server Action persiste o estado atual; o último venceu — não há corrida lógica relevante.

## Arquitetura

### Estrutura de arquivos

```
supabase/sql/
  017_profiles_notify_whatsapp.sql                       # nova coluna
  018_list_pending_predict_reminders_15m_notify_filter.sql  # CREATE OR REPLACE da RPC

src/types/profile.ts                                     # editado: + notify_whatsapp
src/app/(authenticated)/layout.tsx                       # editado: select inclui notify_whatsapp

src/app/(authenticated)/_actions/
  save-notify-whatsapp.ts                                # Server Action nova

src/app/(authenticated)/inicio/
  page.tsx                                               # editado: passa profile.notify_whatsapp adiante
  _components/
    upcoming-matches-section.tsx                         # editado: monta CardHeader com o toggle
    whatsapp-reminder-toggle.tsx                         # Client Component novo
```

### Camada de dados

**Migration 017** — `017_profiles_notify_whatsapp.sql`:

```sql
alter table public.profiles
  add column notify_whatsapp boolean not null default true;
```

- `default true` aplica-se às linhas existentes durante o `ALTER TABLE` (opt-in para todos: novos e atuais).
- Reaproveita as RLS policies existentes (`profiles_update_own`). Diferente de `whatsapp`/`role`, este campo o próprio usuário deve poder mudar — nenhum trigger novo.
- Sem index: cardinalidade e padrão de query não justificam.

**Migration 018** — `018_list_pending_predict_reminders_15m_notify_filter.sql`:

`CREATE OR REPLACE FUNCTION public.list_pending_predict_reminders_15m(...)` com o corpo atual da função, acrescentando o predicado `p.notify_whatsapp = true` ao `WHERE`. Colunas retornadas e assinatura permanecem idênticas — o workflow n8n não precisa de ajuste.

A definição corrente da função não está no repositório (a RPC foi aplicada manualmente no Supabase). A implementação começa por capturar a definição atual via `pg_get_functiondef(...)` no SQL Editor e aplicá-la no migration 018 com o filtro adicionado.

### Tipos

`src/types/profile.ts`:

```ts
export type Profile = {
  // ... campos existentes
  notify_whatsapp: boolean;
};
```

`src/app/(authenticated)/layout.tsx`:

```ts
.select("id, role, display_name, avatar_url, whatsapp, notify_whatsapp, paid, created_at, updated_at")
```

### Server Action

`src/app/(authenticated)/_actions/save-notify-whatsapp.ts`:

```ts
"use server";

export type SaveNotifyWhatsappResult =
  | { ok: true }
  | { ok: false; error: "unauthenticated" | "unknown" };

export async function saveNotifyWhatsapp(
  enabled: boolean,
): Promise<SaveNotifyWhatsappResult>;
```

Implementação:
1. `createClient()` + `getUser()`; sem user → `{ ok: false, error: "unauthenticated" }`.
2. `update profiles set notify_whatsapp = enabled where id = user.id`.
3. Qualquer erro do Supabase → `{ ok: false, error: "unknown" }`.
4. Sucesso → `{ ok: true }`.

Sem `revalidatePath` — o save otimista não depende do servidor reemitir o layout, e a próxima navegação naturalmente relê `profile.notify_whatsapp`.

### Toggle (Client Component)

`src/app/(authenticated)/inicio/_components/whatsapp-reminder-toggle.tsx`:

```ts
"use client";

type Props = { initialEnabled: boolean };
```

Estado local `enabled` controlando o `<Switch>`. `useTransition` envolve a chamada à Server Action. Em caso de erro: revert + `toast.error`. Marca aria do switch usa `aria-label="Lembrete por WhatsApp"`.

### Wire-up na home

`upcoming-matches-section.tsx` já é Server Component. Hoje carrega o user via `supabase.auth.getUser()` para alimentar `getInicioDayMatches`. Para ler `notify_whatsapp` sem refazer query, a opção mais limpa é levantar o load do profile para `inicio/page.tsx` e descê-lo como prop. Mas como o profile já está disponível em `(authenticated)/layout.tsx`, e essa camada é o dono natural dele, vamos por outro caminho:

- `upcoming-matches-section.tsx` faz um `select notify_whatsapp from profiles where id = user.id` adicional (uma query barata, indexada por PK).
- Passa o valor como `initialEnabled` para `<WhatsappReminderToggle />`, renderizado dentro do `<CardHeader>` abaixo do `<CardTitle>`.

Trade-off vs. prop drilling pelo layout: a query extra é negligível e mantém a seção autocontida. Refatorar a passagem de profile pelos layouts foge ao escopo.

## Acessibilidade

- `<Switch>` shadcn é acessível por padrão (`role="switch"`, `aria-checked` automático).
- `aria-label="Lembrete por WhatsApp"` no Switch (a label visual também serve via `htmlFor`/`id`, mas redundância aqui é barata).
- Ícone com `aria-hidden`.

## Testes

Sem testes automatizados nesta spec. O codebase só tem testes de unidade para funções puras (scoring, normalize, formatters) — toda a feature é *glue code* sem lógica pura interessante.

Validação manual:

1. Aplicar migration 017 → `select count(*) from profiles where notify_whatsapp is null` deve retornar 0; `select count(*) from profiles where notify_whatsapp = true` cobre toda a base.
2. Recarregar `/inicio` → toggle aparece ligado.
3. Desligar o toggle, recarregar a página → permanece desligado.
4. Simular falha (devtools → throttling offline ou bloquear o domínio na rede) → estado reverte + toast de erro aparece.
5. Aplicar migration 018 → criar/forçar caso onde `notify_whatsapp = false` para um usuário com palpite pendente em partida em ~15min; rodar workflow n8n manualmente; confirmar que o usuário não aparece no resultado da RPC.

## Decisões e trade-offs

- **Booleano único genérico (`notify_whatsapp`)** em vez de campo escopado por tipo de lembrete. YAGNI — hoje só existe um tipo. Se um dia precisarmos granularidade, refatoramos.
- **Opt-in por padrão (`default true`)** para usuários novos e existentes. Maximiza alcance do lembrete. Risco é percepção de invasão, mitigada pela presença visível do toggle na home.
- **Save otimista sem toast de sucesso** — o próprio Switch é o feedback. Toast só em caso de falha.
- **Sem `revalidatePath`** após salvar — preserva fluidez do save otimista; profile relido na próxima navegação.
- **Query extra para `notify_whatsapp` no `UpcomingMatchesSection`** em vez de prop drilling pelo layout. Custo trivial (lookup por PK) em troca de mantermos a seção autocontida.
- **RPC atualizada via migration 018** mesmo com a função tendo sido aplicada manualmente: garante que reaplicação do schema do zero produza o estado correto.
