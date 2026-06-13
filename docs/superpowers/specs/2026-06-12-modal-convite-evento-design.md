# Modal de convite para evento — Bisteka Bet + Coringas

**Data:** 2026-06-12
**Status:** Aprovado pelo usuário, aguardando review do spec

## Contexto

Já existe no sistema o `PaymentPendingModal` (auto-abre quando o usuário não pagou a
inscrição). Queremos um novo modal, independente, para convidar usuários ao evento
presencial **Bisteka Bet + Equipe Coringas: Rumo ao hexa! 🏆💛** no Xepa do Ipiranga.

### Regras de negócio

- Aparece **apenas** para usuários cujo pagamento está confirmado (`profile.paid === true`).
- Aparece **apenas** quando o admin tiver ligado a flag global no painel.
- Auto-abre toda vez que o usuário entra (sem `sessionStorage`), exceto se o usuário
  marcou "Não exibir novamente" — nesse caso usamos `localStorage` versionado.
- Modal puramente informativo: sem CTA primário, sem WhatsApp, sem mapa, sem data/hora.
- Admin pode ligar/desligar via card com switch em `/admin`.

## Arquitetura

Espelha o padrão já existente do `PaymentPendingModal` + `PaymentPendingTrigger`:

- `event-invite-modal.tsx` — apresentação pura.
- `event-invite-trigger.tsx` — client component que decide se abre, lendo `localStorage`.
- O trigger só é montado pelo `auth-header.tsx` (server) quando a flag está ligada e o
  usuário está pago. A simples presença do trigger no DOM já significa "pode tentar abrir";
  o trigger não recebe prop `enabled`.

### Persistência do toggle do admin

Nova tabela `app_settings` (key/value genérico em jsonb), com RLS:
- read para qualquer authenticated;
- write/update apenas se `is_admin(auth.uid()) = true`.

Default inicial: `event_invite_enabled = false`.

Helpers em `src/lib/app-settings.ts`:
- `getAppSetting<T>(key, fallback): Promise<T>` — server-side; retorna `fallback` em
  qualquer erro de leitura ou row inexistente (falha fechada).
- `setAppSetting<T>(key, value): Promise<void>` — usado pela server action do admin.

## Comportamento do modal (client)

Estado no `EventInviteTrigger`:

- **Chave localStorage:** `bb:event-invite-dismissed-v1` (versionada — bump pra `v2`
  reabre pra todo mundo se mudarmos o evento).
- **Mount/useEffect:** se `localStorage[bb:event-invite-dismissed-v1] === "1"` não abre;
  caso contrário abre.
- **Fechar (X, ESC, clique fora):** apenas fecha. Não grava nada. Próxima sessão reabre.
- **Checkbox "Não exibir novamente":** estado local. Se marcado quando o modal fecha,
  grava `localStorage[bb:event-invite-dismissed-v1] = "1"`.

Diferente do `PaymentPendingModal`, **não usa `sessionStorage`** — qualquer reload
reabre o modal, salvo o checkbox.

## Conteúdo visual

Mesmo tamanho/padding do `PaymentPendingModal` (max-w-md sm, max-w mobile).

1. Botão fechar (X) no canto superior direito, mesmo padrão do atual.
2. Header com **dois logos lado a lado**, pequenos (~`size-12`/48px), centralizados,
   pequeno gap: `BISTECA.png` e `logo_coringas.png`. Sem ring/card.
3. **Título** (font-heading uppercase tracking-wide):
   > Bisteka Bet + Equipe Coringas: Rumo ao hexa! 🏆💛
4. **Descrição** (leading-relaxed, centralizada):
   > Venha assistir a estreia da Seleção com a gente.
5. **Bloco de detalhes** em lista vertical, alinhado à esquerda, com ícones lucide:
   - `MapPin` → **Local:** Xepa do Ipiranga
   - `Beef` (ou `UtensilsCrossed`) → Espetinho com precinho especial
   - `Beer` → Bebidas consumidas do local
6. **Checkbox shadcn** "Não exibir novamente" abaixo, alinhado à esquerda, label
   clicável via `<label htmlFor>`.
7. **Sem CTA primário.** O X é a única ação além do checkbox.

## Admin: card de toggle

`src/app/(authenticated)/admin/_components/event-invite-toggle-card.tsx` — segue o
padrão visual de `RecomputeScoresCard`/`ImportResultsCard`:

- Título: "Convite do evento"
- Descrição: "Controla se o modal de convite para o evento Bisteka Bet + Coringas
  aparece para os usuários ao entrar."
- `Switch` shadcn com label "Exibir modal de convite". Estado inicial vem da prop
  `defaultEnabled` lida no server.
- `useTransition` chama server action `setEventInviteEnabled(value: boolean)` ao
  alternar, com `toast.success`/`toast.error`.

**Server action** em `src/app/(authenticated)/admin/_actions.ts`:
- `setEventInviteEnabled(enabled: boolean)` valida `supabase.rpc("is_admin", { uid })`
  como o `recomputeAllScores` já faz; chama `setAppSetting("event_invite_enabled", enabled)`;
  retorna `{ ok: boolean, error?: string }`; faz `revalidatePath("/")` e
  `revalidatePath("/admin")`.

**Page admin (`admin/page.tsx`):** lê
`getAppSetting("event_invite_enabled", false)` no server e renderiza
`<EventInviteToggleCard defaultEnabled={...} />` na grid junto com os outros cards.

## Montagem no `auth-header.tsx`

```tsx
const eventInviteEnabled = profile.paid
  ? await getAppSetting("event_invite_enabled", false)
  : false;

// ...
{!profile.paid && <PaymentPendingTrigger />}
{eventInviteEnabled && <EventInviteTrigger />}
```

Lazy: só consulta `app_settings` se o usuário está pago. Quem não pagou pula a query.

## Migration SQL

`supabase/sql/014_app_settings.sql`:

```sql
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy "app_settings_read_authenticated"
  on public.app_settings for select
  to authenticated using (true);

create policy "app_settings_write_admin"
  on public.app_settings for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

insert into public.app_settings (key, value)
values ('event_invite_enabled', 'false'::jsonb)
on conflict (key) do nothing;
```

## Tratamento de erro / acessibilidade

- `getAppSetting` cai no fallback `false` em qualquer falha → modal não aparece, header
  não quebra.
- Server action com try/catch retornando `{ ok, error? }`; card mostra toast em falha.
- `DialogTitle` e `DialogDescription` preenchidos para A11y.
- Botão X com `aria-label="Fechar"`.
- Checkbox com label associado (`<label htmlFor>`).

## YAGNI (escopo explícito)

- Sem CTA, sem WhatsApp, sem botão de mapa.
- Sem data/hora exibida.
- Sem analytics de quem fechou/marcou.
- Sem agendamento automático (data início/fim) — admin liga/desliga manualmente.
- Sem i18n — texto direto em pt-BR, como o restante.
- Sem testes automatizados nesta entrega (alinhado com o estado atual do projeto).

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `supabase/sql/014_app_settings.sql` | criar |
| `src/lib/app-settings.ts` | criar |
| `src/app/(authenticated)/_components/event-invite-modal.tsx` | criar |
| `src/app/(authenticated)/_components/event-invite-trigger.tsx` | criar |
| `src/app/(authenticated)/_components/auth-header.tsx` | editar (montar trigger) |
| `src/app/(authenticated)/admin/_components/event-invite-toggle-card.tsx` | criar |
| `src/app/(authenticated)/admin/_actions.ts` | editar (`setEventInviteEnabled`) |
| `src/app/(authenticated)/admin/page.tsx` | editar (renderizar card) |
