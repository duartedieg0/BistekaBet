# Coleta obrigatória de WhatsApp no primeiro acesso

**Data:** 2026-05-10
**Escopo:** Adicionar campo `whatsapp` em `profiles` e exibir um modal não-dismissível em todas as rotas autenticadas enquanto o usuário (incluindo admin) não tiver preenchido. Salvo como E.164 BR sem o nono dígito (`+55DDDXXXXXXXX`).

## Contexto

O bolão precisa do WhatsApp dos participantes para adicioná-los ao grupo onde são enviadas mensagens da Copa. Hoje `profiles` tem `id, role, display_name, avatar_url, paid, created_at, updated_at` — sem telefone. A UX precisa garantir que **todo usuário autenticado preencha** o número antes de usar o app.

Decisões fechadas na conversa de brainstorming:
- **Formato visual:** máscara BR `(DDD) 9XXXX-XXXX` (11 dígitos com 9 obrigatório no input).
- **Formato no banco:** E.164 sem o nono dígito → `+55DDDXXXXXXXX` (12 dígitos após o `+`). Justificativa: integração futura com APIs de WhatsApp que normalizam BR sem o 9.
- **Escopo do bloqueio:** todas as rotas autenticadas (modal renderizado pelo layout, não apenas em `/inicio`). Sem redirecionamento — modal sobrepõe a rota onde o usuário estiver.
- **Unicidade:** número único por perfil (`unique` constraint).
- **Edição:** usuário **não** edita pelo app depois de preenchido. Admin enxerga em `/admin/usuarios` (read-only). Correções pós-preenchimento via service role/SQL.
- **Sem escape:** modal não pode ser fechado por `Esc`, click fora ou botão X. Sem botão "Sair". A única ação possível é preencher.
- **Sem isenção:** admin também é bloqueado até preencher.

## Arquitetura

```
supabase/sql/
  011_profiles_whatsapp.sql                  # nova migração (manual)

src/types/profile.ts                          # +whatsapp: string | null

src/app/(authenticated)/
  layout.tsx                                  # render condicional do modal
  _actions/
    save-whatsapp.ts                          # server action: valida, normaliza, persiste
  _components/
    whatsapp-required-modal.tsx               # client: dialog não-dismissível
    whatsapp-input.tsx                        # client: input com máscara
```

## Schema do banco

`supabase/sql/011_profiles_whatsapp.sql`:

```sql
alter table public.profiles
  add column whatsapp text unique
    check (whatsapp ~ '^\+55[1-9][0-9][2-9][0-9]{7}$');
-- formato: +55 DDD XXXXXXXX (12 dígitos após o +)
-- DDD: dois dígitos onde o primeiro ≠ 0
-- número: 8 dígitos onde o primeiro ≠ 0/1 (evita prefixos inválidos)

create or replace function public.prevent_whatsapp_change() returns trigger
language plpgsql as $$
begin
  -- só permite NULL → valor (preenchimento inicial pelo próprio usuário).
  -- alterar valor existente exige service role.
  if old.whatsapp is not null
     and new.whatsapp is distinct from old.whatsapp
     and current_user not in ('postgres','service_role','supabase_admin')
  then
    raise exception 'whatsapp can only be changed via service role';
  end if;
  return new;
end $$;

create trigger profiles_prevent_whatsapp_change
  before update on public.profiles
  for each row execute function public.prevent_whatsapp_change();
```

Decisões:
- `unique` cobre dedup; violação retorna 23505 e é mapeada na action.
- `check` regex impede lixo no banco mesmo se a server action falhar; violação retorna 23514.
- Trigger garante a regra "só preenche uma vez via UI". Mudanças posteriores exigem service role (admin via SQL).
- Coluna criada como `null` é compatível com o trigger `handle_new_user` atual — não precisa alterar `001_init_profiles.sql`.
- A policy `profiles_update_own` existente já permite ao usuário atualizar a própria linha.
- A policy `profiles_admin_read_all` existente já dá leitura ao admin (que vai usar em `/admin/usuarios`).

## Tipo `Profile`

`src/types/profile.ts`:

```ts
export type Profile = {
  id: string;
  role: Role;
  display_name: string;
  avatar_url: string | null;
  whatsapp: string | null;        // novo
  created_at: string;
  updated_at: string;
};
```

`src/app/(authenticated)/layout.tsx` precisa incluir `whatsapp` no `select` e o componente do modal.

## Server action

`src/app/(authenticated)/_actions/save-whatsapp.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const DIGITS_RE = /\D/g;

export type SaveWhatsappResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "duplicate" | "unauthenticated" | "unknown" };

export async function saveWhatsapp(formData: FormData): Promise<SaveWhatsappResult> {
  const raw = String(formData.get("whatsapp") ?? "");
  const digits = raw.replace(DIGITS_RE, "");

  // Esperado da máscara: 11 dígitos (DDD + 9 + 8). Strip do 9 → 10 dígitos pós-DDD.
  if (digits.length !== 11 || digits[2] !== "9") return { ok: false, error: "invalid" };
  const ddd = digits.slice(0, 2);
  const eightDigits = digits.slice(3); // remove o 9
  if (ddd[0] === "0") return { ok: false, error: "invalid" };
  if (eightDigits[0] === "0" || eightDigits[0] === "1") return { ok: false, error: "invalid" };

  const e164 = `+55${ddd}${eightDigits}`;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ whatsapp: e164 })
    .eq("id", user.id)
    .is("whatsapp", null); // evita race / re-escrita

  if (error) {
    if (error.code === "23505") return { ok: false, error: "duplicate" };
    if (error.code === "23514") return { ok: false, error: "invalid" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
```

Decisões:
- Validação dupla (action + check no banco): mensagem de erro melhor sem perder integridade.
- `.is("whatsapp", null)` no `update` evita sobrescrita acidental e cobre corrida (dois cliques rápidos).
- Códigos 23505/23514 mapeados em mensagens UI amigáveis.
- `revalidatePath("/", "layout")` re-renderiza `(authenticated)/layout.tsx` e o modal some no próximo render. O usuário continua na rota onde estava.

## Layout autenticado

`src/app/(authenticated)/layout.tsx` adiciona:

```tsx
const { data: profile } = await supabase
  .from("profiles")
  .select("id, role, display_name, avatar_url, whatsapp, created_at, updated_at")
  .eq("id", user.id)
  .single<Profile>();

if (!profile) redirect("/?error=profile");

return (
  <div className="flex min-h-screen flex-col bg-background">
    <AuthHeader profile={profile} />
    <div className="flex-1">{children}</div>
    <Toaster richColors position="top-right" />
    {profile.whatsapp === null && <WhatsappRequiredModal />}
  </div>
);
```

O modal é renderizado fora de `<main>` (children), em portal via Radix Dialog — sobrepõe qualquer rota autenticada.

## Modal `whatsapp-required-modal.tsx`

Componente cliente. Usa `Dialog` do shadcn (Radix) com bloqueio total:

- `open={true}` fixo, sem `onOpenChange`.
- Sem `DialogClose`, sem botão X.
- `onEscapeKeyDown={(e) => e.preventDefault()}`.
- `onPointerDownOutside={(e) => e.preventDefault()}`.
- Backdrop padrão do shadcn já esmaece o fundo (`bg-black/80`).
- `useActionState` (React 19) ligado a `saveWhatsapp`; `useTransition` para o estado pending.

### Conteúdo (top → bottom)

1. **Logo** `BISTECA.png` em `<Image>` size-16 desktop / size-14 mobile, centralizado, com glow sutil em verde primário (mesmo padrão visual do header).
2. **Título** (h2, font-heading, uppercase, tracking-wide): "Falta um detalhe pra entrar no grupo".
3. **Mensagem** (text-muted-foreground, leading-relaxed): "Pra te adicionar ao grupo do WhatsApp do bolão (avisos de jogos, palpites e ranking), precisamos do seu número."
4. **`<WhatsappInput>`** com placeholder `(11) 91234-5678`, autoFocus, `inputMode="numeric"`, label "WhatsApp".
5. **Mensagem de erro inline** (text-destructive text-sm) só quando há erro:
   - `invalid` → "Número inválido. Use (DDD) 9XXXX-XXXX."
   - `duplicate` → "Esse número já foi cadastrado por outro participante."
   - `unauthenticated` → "Sessão expirou. Recarregue a página."
   - `unknown` → "Erro ao salvar. Tente novamente."
6. **Botão primário** full-width "Salvar e continuar". `disabled` enquanto pending ou input < 11 dígitos.
7. **Copy muted abaixo** (text-xs text-muted-foreground): "Seu número fica visível só pra organização do bolão."

## Input com máscara `whatsapp-input.tsx`

Componente cliente, controlado. Comportamento:

- `onChange`: strippa todo não-dígito, limita a 11 caracteres, formata como `(DD) 9XXXX-XXXX` durante a digitação:
  - 0 dígitos → vazio
  - 1-2 dígitos → `(DD`
  - 3 dígitos → `(DD) X`
  - 7 dígitos → `(DD) 9XXXX`
  - 8-11 dígitos → `(DD) 9XXXX-XXXX`
- `inputMode="numeric"` — abre teclado numérico no mobile.
- Submit envia o valor mascarado pelo `name="whatsapp"`; a action faz strip e normalização.
- `aria-invalid` ligado quando há erro; `aria-describedby` aponta pra mensagem de erro.

## Mobile (≤sm)

- `DialogContent`: `w-[calc(100vw-2rem)] max-w-md p-6`, `pb-[env(safe-area-inset-bottom)]` para respeitar safe area.
- Input: `h-12 text-base` (font-size ≥16px evita zoom automático no iOS Safari).
- Botão: `h-12 text-base font-semibold`.
- Logo: `size-14` no mobile, `size-16` em `>=sm`.
- Backdrop cobre 100vh (incluindo a navegação inferior do `AuthHeader`).
- Sem scroll interno: o conteúdo cabe sem rolagem em viewports ≥320×568.

## Acessibilidade

- `role="dialog"`, `aria-modal="true"` (Radix Dialog faz por padrão).
- Focus trap dentro do modal (Radix).
- `<Label htmlFor="whatsapp">WhatsApp</Label>` visível.
- `aria-invalid` no input quando há erro de validação.
- `aria-describedby` ligando input à mensagem de erro.
- `aria-live="polite"` na região de erro pra leitores de tela anunciarem.
- Botão de envio descreve a ação ("Salvar e continuar").

## Fluxo de envio

1. Usuário preenche os 11 dígitos (input se ativa).
2. Clica "Salvar e continuar".
3. `useActionState` invoca `saveWhatsapp(formData)`.
4. **Sucesso** → `revalidatePath("/", "layout")` força re-render do layout autenticado; o modal some no próximo paint; o usuário continua exatamente na rota onde estava (sem redirecionamento).
5. **Erro** → modal permanece aberto; mensagem inline aparece; input mantém o valor digitado pra correção rápida.

## Casos especiais e o que não está coberto

- **Admin/usuarios:** este spec adiciona o campo no tipo `Profile`. Exibir o número na tela de admin (read-only) não está no escopo deste spec — fica como follow-up trivial (uma coluna a mais na tabela).
- **Edição posterior pelo usuário:** fora de escopo. Trigger `prevent_whatsapp_change` impede via UI; correções só via SQL.
- **Validação de DDD real (existência da operadora):** fora de escopo — apenas regex estrutural.
- **Internacional:** fora de escopo — apenas BR.
- **Notificação WhatsApp / integração com API de envio:** fora de escopo — só coleta o dado.

## Riscos e mitigações

- **Usuário com número errado fica preso?** Não — admin pode limpar via SQL (`update profiles set whatsapp = null where id = ...` rodando como service role) e o modal volta a aparecer no próximo carregamento.
- **Race entre dois cliques no submit:** mitigado por `.is("whatsapp", null)` no update + `disabled` no botão durante pending.
- **Bypass via API direta:** policies + trigger garantem que apenas o dono atualiza, e apenas de NULL → valor.
- **iOS zoom em input:** mitigado com `text-base` (16px+).

## Testes

Cenários a cobrir manualmente após implementação:
- Usuário novo: ao logar pela primeira vez, modal aparece em `/inicio`. Não fecha com Esc, click fora, ou botão X (não existe).
- Usuário com `whatsapp` já preenchido: modal não aparece em nenhuma rota.
- Submit com número inválido (10 dígitos, sem 9, DDD começando com 0): erro inline.
- Submit com número já usado por outro perfil: erro "já foi cadastrado".
- Submit válido: modal some, navegação continua na mesma rota.
- Admin sem WhatsApp tentando acessar `/admin`: bloqueado pelo modal.
- Mobile: input não causa zoom no iOS; botão clicável; logo aparece; sem scroll interno.
- Tentativa de acessar diretamente `/palpites` sem WhatsApp preenchido: modal aparece sobreposto.
