# Admin Pagamentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que admins marquem usuários como pagos diretamente em `/admin/usuarios`.

**Architecture:** Coluna booleana `paid` em `public.profiles` protegida por trigger SQL contra writes não-admin. Toggle (Switch shadcn) na tabela existente dispara Server Action que valida admin via `is_admin` RPC e atualiza via `service_role`, seguido de `revalidatePath`. Sucesso silencioso, erro via `sonner` toast.

**Tech Stack:** Next.js 15 (App Router, RSC, Server Actions) · Supabase (auth + RLS + triggers) · shadcn/ui (Switch) · sonner · TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-08-admin-pagamentos-design.md`

**Notas para o executor:**
- Projeto não tem suíte de testes automatizados. Verificação é manual conforme passos descritos.
- Package manager: **npm** (`package-lock.json`).
- Migrações SQL são aplicadas **manualmente** no Supabase Studio (SQL Editor) com service role — não há CLI de migration neste repo. Os arquivos em `supabase/sql/` são histórico/referência.
- O `<Toaster />` da `sonner` já está montado em `src/app/(authenticated)/layout.tsx`. Não duplicar.
- Componente shadcn: este projeto usa `style: "base-nova"` em `components.json`. Use `npx shadcn@latest add switch`.

---

## File Structure

**Criar:**
- `supabase/sql/007_profiles_paid.sql` — migração: coluna `paid` + trigger de proteção.
- `src/components/ui/switch.tsx` — gerado pelo shadcn CLI.
- `src/app/(authenticated)/admin/usuarios/actions.ts` — Server Action `setUserPaid`.
- `src/app/(authenticated)/admin/usuarios/_components/paid-toggle.tsx` — client component com Switch.

**Modificar:**
- `src/app/(authenticated)/admin/usuarios/page.tsx` — incluir `paid` nos tipos/select, adicionar coluna na tabela.

---

## Task 1: Migração SQL (coluna `paid` + trigger)

**Files:**
- Create: `supabase/sql/007_profiles_paid.sql`

- [ ] **Step 1: Criar arquivo de migração**

Conteúdo de `supabase/sql/007_profiles_paid.sql`:

```sql
-- BistekaBet — controle de pagamento por usuário (admin-only)
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

alter table public.profiles
  add column paid boolean not null default false;

-- A policy "profiles_update_own" permite ao próprio usuário fazer UPDATE
-- na linha. Para impedir auto-marcação, bloqueamos mudanças no campo
-- paid quando current_user não é service_role.
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

- [ ] **Step 2: Aplicar no Supabase Studio**

Abrir o projeto no Supabase Studio → SQL Editor → colar o conteúdo do arquivo → Run.

Verificar no Table Editor que `profiles` tem a coluna `paid` (boolean, default false, not null).

- [ ] **Step 3: Verificar trigger funciona**

No SQL Editor (autenticado como service_role do Studio, então o update deve passar):

```sql
update public.profiles set paid = true where id = '<algum-uuid>' returning id, paid;
update public.profiles set paid = false where id = '<algum-uuid>' returning id, paid;
```

Esperado: ambos retornam linha. Para validar bloqueio com role autenticada não-admin, ver Task 6 (verificação manual).

- [ ] **Step 4: Commit**

```bash
git add supabase/sql/007_profiles_paid.sql
git commit -m "feat(db): add profiles.paid column with admin-only trigger"
```

---

## Task 2: Adicionar componente Switch (shadcn)

**Files:**
- Create: `src/components/ui/switch.tsx`

- [ ] **Step 1: Confirmar que Switch ainda não existe**

Run: `ls src/components/ui/switch.tsx`
Expected: `No such file or directory`

- [ ] **Step 2: Adicionar via shadcn CLI**

Run: `npx shadcn@latest add switch`

Quando perguntar sobre overwrite, escolher não para nenhum arquivo existente. O CLI deve criar apenas `src/components/ui/switch.tsx` e talvez instalar `@radix-ui/react-switch` em `package.json`.

- [ ] **Step 3: Verificar arquivo gerado**

Run: `cat src/components/ui/switch.tsx | head -20`
Expected: arquivo com `"use client"` e export de `Switch` baseado em `@radix-ui/react-switch`.

- [ ] **Step 4: Verificar tipagem**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `switch.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/switch.tsx package.json package-lock.json
git commit -m "feat(ui): add Switch component from shadcn"
```

---

## Task 3: Server Action `setUserPaid`

**Files:**
- Create: `src/app/(authenticated)/admin/usuarios/actions.ts`

- [ ] **Step 1: Criar arquivo da action**

Conteúdo de `src/app/(authenticated)/admin/usuarios/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setUserPaid(userId: string, paid: boolean): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin", {
    uid: user.id,
  });
  if (rpcError) throw rpcError;
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

- [ ] **Step 2: Confirmar imports existem**

Run: `ls src/lib/supabase/server.ts src/lib/supabase/admin.ts`
Expected: ambos existem.

Verificar a assinatura de `createClient` em `src/lib/supabase/server.ts`. Se for síncrono no projeto atual, remover o `await`. Se for async (padrão do Supabase SSR mais novo), manter.

- [ ] **Step 3: Verificar tipagem**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/(authenticated)/admin/usuarios/actions.ts
git commit -m "feat(admin): add setUserPaid server action"
```

---

## Task 4: Client component `PaidToggle`

**Files:**
- Create: `src/app/(authenticated)/admin/usuarios/_components/paid-toggle.tsx`

- [ ] **Step 1: Criar componente**

Conteúdo de `src/app/(authenticated)/admin/usuarios/_components/paid-toggle.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setUserPaid } from "../actions";

type PaidToggleProps = {
  userId: string;
  paid: boolean;
};

export function PaidToggle({ userId, paid }: PaidToggleProps) {
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

- [ ] **Step 2: Verificar tipagem**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(authenticated)/admin/usuarios/_components/paid-toggle.tsx
git commit -m "feat(admin): add PaidToggle client component"
```

---

## Task 5: Wire `paid` na página de usuários

**Files:**
- Modify: `src/app/(authenticated)/admin/usuarios/page.tsx`

- [ ] **Step 1: Atualizar tipos `ProfileRow` e `UserRow`**

Em `page.tsx`, adicionar `paid: boolean;` ao final de ambos os tipos:

```ts
type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  paid: boolean;
};

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  paid: boolean;
};
```

- [ ] **Step 2: Incluir `paid` no select e no map**

Em `loadUsers`, atualizar:

```ts
const { data: profiles, error: profErr } = await supabase
  .from("profiles")
  .select("id, display_name, avatar_url, created_at, paid");
```

E no objeto retornado em `.map<UserRow>`:

```ts
return {
  id: u.id,
  email: u.email ?? "—",
  displayName: p?.display_name ?? u.email?.split("@")[0] ?? "—",
  avatarUrl: p?.avatar_url ?? null,
  createdAt: p?.created_at ?? u.created_at,
  lastSignInAt: u.last_sign_in_at ?? null,
  paid: p?.paid ?? false,
};
```

- [ ] **Step 3: Importar `PaidToggle`**

No topo do arquivo, junto aos demais imports:

```tsx
import { PaidToggle } from "./_components/paid-toggle";
```

- [ ] **Step 4: Adicionar coluna "Pago" no `TableHeader`**

Entre o `<TableHead>Email</TableHead>` e `<TableHead>Cadastro</TableHead>`:

```tsx
<TableHead>Pago</TableHead>
```

Atualizar também o `colSpan` da row vazia: era `5`, passa a `6`.

- [ ] **Step 5: Adicionar célula com toggle nas linhas**

Entre a célula de email e a de cadastro, adicionar:

```tsx
<TableCell>
  <PaidToggle userId={u.id} paid={u.paid} />
</TableCell>
```

- [ ] **Step 6: Atualizar subtítulo com contador**

No `<p className="text-muted-foreground">` do header, substituir o texto atual por:

```tsx
<p className="text-muted-foreground">
  {users.length} {users.length === 1 ? "usuário cadastrado" : "usuários cadastrados"}
  {users.length > 0 ? ` · ${users.filter((u) => u.paid).length} pagaram` : ""}.
</p>
```

- [ ] **Step 7: Verificar tipagem e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/app/(authenticated)/admin/usuarios/page.tsx
git commit -m "feat(admin): show paid status with toggle in users table"
```

---

## Task 6: Verificação manual end-to-end

**Files:**
- nenhum (apenas validação)

- [ ] **Step 1: Subir o dev server**

Run: `npm run dev`
Esperado: servidor em `http://localhost:3000` sem erros de build.

- [ ] **Step 2: Caminho feliz como admin**

1. Logar com um usuário cujo `profiles.role = 'admin'`.
2. Acessar `/admin/usuarios`.
3. A coluna "Pago" deve aparecer com Switch desligado para todos (default false).
4. Ligar o Switch de um usuário → o componente deve ficar `disabled` brevemente, depois persistir ligado.
5. Hard refresh (Ctrl+F5) → estado deve permanecer.
6. Desligar → mesmo comportamento.
7. Subtítulo deve refletir "X pagaram".

- [ ] **Step 3: Bloqueio para usuário comum**

1. Logar como usuário com `role = 'usuario'`.
2. Tentar acessar `/admin/usuarios` → deve ser barrado pelo layout existente (mesmo comportamento de antes da mudança).

- [ ] **Step 4: Trigger SQL bloqueia escrita não-admin**

No Supabase Studio → SQL Editor, simular o role autenticado:

```sql
set local role authenticated;
set local request.jwt.claim.sub = '<uuid-de-um-usuario-comum>';

update public.profiles set paid = true where id = '<uuid-de-um-usuario-comum>';
```

Esperado: erro `paid can only be changed via service role`.

Reset:

```sql
reset role;
```

- [ ] **Step 5: Fluxo de erro mostra toast**

Forma simples de testar: temporariamente alterar `setUserPaid` para `throw new Error("test")` no início, recarregar `/admin/usuarios`, clicar no toggle → toast vermelho deve aparecer. Reverter alteração antes de continuar.

- [ ] **Step 6: Sem regressões em outras páginas admin**

Rodar visualmente `/admin`, `/admin/partidas`, `/admin/times` → carregam normalmente.

- [ ] **Step 7: Build de produção**

Run: `npm run build`
Esperado: build sem erros.

---

## Done criteria

- [x] Coluna `paid` existe em `profiles`, default false, protegida por trigger.
- [x] `Switch` shadcn instalado.
- [x] `/admin/usuarios` mostra coluna "Pago" com toggle funcional.
- [x] Server Action valida admin antes de escrever.
- [x] Erro mostra toast; sucesso é silencioso (revalidação atualiza tabela).
- [x] Build e typecheck passam.
- [x] Verificação manual end-to-end concluída.
