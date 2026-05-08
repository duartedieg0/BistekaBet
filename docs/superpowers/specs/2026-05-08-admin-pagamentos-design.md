# Admin — Controle de pagamento de usuários

## Contexto

O bolão da Copa 2026 cobra inscrição dos participantes. Hoje o admin tem `/admin/usuarios` listando todos os participantes, mas não há registro de quem já pagou. O controle é feito por fora (planilha, mensagem). Esta feature traz o estado de pagamento para dentro do app.

## Escopo

- Admin marca/desmarca cada usuário como pago direto na tabela `/admin/usuarios`.
- Estado é persistido no banco e reflete no carregamento da página.
- Sem efeitos no resto do app: não bloqueia palpites, não exibe aviso para o usuário comum. É puro controle interno do admin.

Fora de escopo (v1): histórico de quem mudou e quando, valor pago, método, múltiplas competições, badge de status para o usuário, bloqueio de palpites.

## Modelo de dados

Coluna nova em `public.profiles`:

```sql
alter table public.profiles
  add column paid boolean not null default false;
```

A política RLS existente `profiles_update_own` permite que o usuário comum atualize a própria linha (`with check (auth.uid() = id)`), o que abriria caminho para auto-marcação. Bloqueamos com trigger no mesmo padrão de `prevent_role_change`:

```sql
create or replace function public.prevent_paid_change() returns trigger
language plpgsql as $$
begin
  if new.paid is distinct from old.paid
     and current_user not in ('postgres', 'service_role', 'supabase_admin')
  then
    raise exception 'paid can only be changed via service role';
  end if;
  return new;
end $$;

create trigger profiles_prevent_paid_change
  before update on public.profiles
  for each row execute function public.prevent_paid_change();
```

Migração entra como `supabase/sql/007_profiles_paid.sql`, aplicada manualmente no Supabase Studio (mesmo padrão dos demais).

## Arquitetura

Server Action + revalidação. Sem rota nova de API. Toggle é um client component leve dentro de RSC.

### Server Action

`src/app/(authenticated)/admin/usuarios/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setUserPaid(userId: string, paid: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data: isAdmin } = await supabase.rpc("is_admin", { uid: user.id });
  if (!isAdmin) throw new Error("forbidden");

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ paid })
    .eq("id", userId);
  if (error) throw error;

  revalidatePath("/admin/usuarios");
}
```

Validação dupla: sessão + `is_admin` antes de tocar a escrita. `service_role` só roda após autorização — nunca exposto ao cliente.

### Toggle (client component)

`src/app/(authenticated)/admin/usuarios/_components/paid-toggle.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setUserPaid } from "../actions";

export function PaidToggle({ userId, paid }: { userId: string; paid: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={paid}
      disabled={pending}
      onCheckedChange={(next) => {
        startTransition(async () => {
          try {
            await setUserPaid(userId, next);
          } catch {
            toast.error("Não foi possível atualizar o status de pagamento.");
          }
        });
      }}
      aria-label={paid ? "Marcar como não pago" : "Marcar como pago"}
    />
  );
}
```

Sucesso é silencioso — a tabela re-renderiza com o estado novo via `revalidatePath`. Erro mostra toast usando `sonner` (já instalado).

Dependência nova: componente `Switch` do shadcn. Se ainda não estiver em `components/ui`, adicionar via CLI do shadcn antes de implementar o toggle.

### Mudanças em `usuarios/page.tsx`

- `ProfileRow` e `UserRow` ganham `paid: boolean`.
- `loadUsers` inclui `paid` no `select` de profiles e no map de `UserRow`.
- Header da tabela ganha coluna **Pago** entre "Email" e "Cadastro".
- Cada linha renderiza `<PaidToggle userId={u.id} paid={u.paid} />`.
- Opcional: subtítulo ganha contador "X de Y pagaram" para visão rápida.

## Fluxo

1. Admin abre `/admin/usuarios` → RSC carrega lista com `paid` por usuário.
2. Admin clica no `Switch` de uma linha.
3. Client component dispara `setUserPaid(userId, next)` em `useTransition`.
4. Server Action valida admin → atualiza via service-role → `revalidatePath`.
5. Next refaz a RSC, tabela re-renderiza com novo estado. Switch sai de `pending`.
6. Em caso de erro, toast informa o admin.

## Tratamento de erros

- Não autenticado / não admin → erro lançado, toast genérico no client.
- Falha de rede / DB → idem.
- Tentativa de update com role não-admin → trigger SQL aborta a transação.

## Testes

Projeto não tem suíte automatizada (sem `vitest`, `__tests__`). Mantemos coerência: feature validada manualmente.

Roteiro:
1. Como admin, ligar/desligar toggle de um usuário; refresh confirma persistência.
2. Como usuário comum, `/admin/usuarios` permanece bloqueado pelo layout existente.
3. Conexão SQL com role `authenticated` (não-admin) tentando `update profiles set paid=true where id=<other>` deve falhar pelo trigger.
4. Toast aparece quando a Server Action é forçada a falhar (ex.: matar conexão).

## Riscos e considerações

- `paid` é booleano sem auditoria. Se no futuro precisar saber "quem marcou e quando", evolui-se para `paid_at` + `paid_by`. v1 prioriza simplicidade.
- Sem optimistic update: o switch fica `disabled` durante a transição. Para listas longas com muitas marcações em sequência, pode incomodar. Solução fica para v2 com `useOptimistic`.
- A página atual carrega até 1000 usuários. Continua adequado para o tamanho previsto do bolão; nenhuma mudança de paginação necessária.
