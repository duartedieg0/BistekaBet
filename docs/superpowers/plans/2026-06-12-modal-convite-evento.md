# Modal de convite para evento — Bisteka + Coringas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um modal de convite ao evento "Bisteka Bet + Equipe Coringas: Rumo ao hexa!" que auto-abre para usuários pagos quando o admin habilita um toggle global, com opção "Não exibir novamente" (localStorage).

**Architecture:** Espelha o padrão `PaymentPendingModal` + `PaymentPendingTrigger` existente. Nova tabela `app_settings` (key/value jsonb) persiste o flag global; helpers em `src/lib/app-settings.ts` leem/gravam no server. O trigger é montado em `auth-header.tsx` apenas quando `profile.paid` é true e o flag está ligado. Card no painel admin alterna o flag via server action que reusa o padrão `is_admin` rpc.

**Tech Stack:** Next.js (App Router, server components + server actions), Supabase Postgres + RLS, shadcn/ui (Dialog, Switch, Checkbox, Card), Tailwind, lucide-react, sonner.

**Spec:** `docs/superpowers/specs/2026-06-12-modal-convite-evento-design.md` (commit `17e892f`).

**Notas de processo:**
- O projeto **não tem suíte de testes automatizados** — cada task termina com `pnpm lint` (ou `npm run lint`) + `pnpm build` (ou verificação manual no `pnpm dev`) e commit. Sem TDD.
- Sempre usar caminhos POSIX nos arquivos do projeto (o repo é Windows mas usa imports com `/`).
- Convenção de commit do repo: `feat(scope): mensagem em português` (ver `git log`).

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/sql/014_app_settings.sql` | criar | Tabela `app_settings` + RLS + seed do flag |
| `src/lib/app-settings.ts` | criar | Helpers `getAppSetting` / `setAppSetting` (server-only) |
| `src/components/ui/checkbox.tsx` | criar (via shadcn CLI) | Componente Checkbox shadcn |
| `src/app/(authenticated)/_components/event-invite-modal.tsx` | criar | Apresentação pura do modal |
| `src/app/(authenticated)/_components/event-invite-trigger.tsx` | criar | Client component: auto-open + localStorage |
| `src/app/(authenticated)/_components/auth-header.tsx` | editar | Montar `<EventInviteTrigger />` quando aplicável |
| `src/app/(authenticated)/admin/_actions.ts` | editar | Adicionar `setEventInviteEnabled` |
| `src/app/(authenticated)/admin/_components/event-invite-toggle-card.tsx` | criar | Card com switch no painel admin |
| `src/app/(authenticated)/admin/page.tsx` | editar | Renderizar o novo card |

---

## Task 1: Migration SQL — `app_settings`

**Files:**
- Create: `supabase/sql/014_app_settings.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/sql/014_app_settings.sql
-- Tabela de configurações globais key/value (admin toggles).

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_read_authenticated" on public.app_settings;
create policy "app_settings_read_authenticated"
  on public.app_settings for select
  to authenticated using (true);

drop policy if exists "app_settings_write_admin" on public.app_settings;
create policy "app_settings_write_admin"
  on public.app_settings for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

insert into public.app_settings (key, value)
values ('event_invite_enabled', 'false'::jsonb)
on conflict (key) do nothing;
```

- [ ] **Step 2: Aplicar a migration no Supabase**

Rodar o SQL no Supabase (SQL editor do dashboard ou `supabase db push` se houver CLI configurado). Verificar:
- `select * from public.app_settings;` retorna a linha `event_invite_enabled = false`.
- `\d public.app_settings` (ou query pg_policies) mostra as 2 policies.

- [ ] **Step 3: Commit**

```bash
git add supabase/sql/014_app_settings.sql
git commit -m "feat(db): tabela app_settings com RLS para toggles globais"
```

---

## Task 2: Helpers `src/lib/app-settings.ts`

**Files:**
- Create: `src/lib/app-settings.ts`

- [ ] **Step 1: Criar o helper**

```ts
// src/lib/app-settings.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getAppSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle<{ value: T }>();
    if (error || !data) return fallback;
    return data.value;
  } catch {
    return fallback;
  }
}

export async function setAppSetting<T>(key: string, value: T): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw error;
}
```

- [ ] **Step 2: Verificar tipos e lint**

```bash
pnpm lint
```
Esperado: zero erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/lib/app-settings.ts
git commit -m "feat(app-settings): helpers get/set para configurações globais"
```

---

## Task 3: Instalar componente shadcn `Checkbox`

**Files:**
- Create: `src/components/ui/checkbox.tsx`

- [ ] **Step 1: Adicionar via shadcn CLI**

```bash
pnpm dlx shadcn@latest add checkbox
```

Se o CLI perguntar sobreescrever arquivos existentes, recusar (apenas o `checkbox.tsx` deve ser criado).

- [ ] **Step 2: Verificar que o arquivo foi criado**

Confirmar que `src/components/ui/checkbox.tsx` existe e exporta `Checkbox`.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```
Esperado: zero erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/checkbox.tsx
git commit -m "feat(ui): adicionar componente Checkbox via shadcn"
```

---

## Task 4: Componente `EventInviteModal` (apresentação)

**Files:**
- Create: `src/app/(authenticated)/_components/event-invite-modal.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";

import Image from "next/image";
import { Beer, MapPin, UtensilsCrossed, XIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EventInviteModal({
  open,
  onOpenChange,
  dontShowAgain,
  onDontShowAgainChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dontShowAgain: boolean;
  onDontShowAgainChange: (value: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-2rem)] gap-5 p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:max-w-md"
      >
        <DialogClose
          render={
            <button
              type="button"
              aria-label="Fechar"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "absolute top-2 right-2",
              )}
            />
          }
        >
          <XIcon />
        </DialogClose>

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center gap-3">
            <Image
              src="/BISTECA.png"
              alt="Bisteka Bet"
              width={48}
              height={48}
              className="size-12 object-contain"
            />
            <Image
              src="/logo_coringas.png"
              alt="Equipe Coringas"
              width={48}
              height={48}
              className="size-12 object-contain"
            />
          </div>
          <DialogTitle className="text-center font-heading text-xl uppercase tracking-wide">
            Bisteka Bet + Equipe Coringas: Rumo ao hexa! 🏆💛
          </DialogTitle>
          <DialogDescription className="text-center leading-relaxed">
            Venha assistir a estreia da Seleção com a gente.
          </DialogDescription>
        </div>

        <ul className="flex flex-col gap-3 text-sm">
          <li className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              <span className="font-semibold">Local:</span> Xepa do Ipiranga
            </span>
          </li>
          <li className="flex items-start gap-3">
            <UtensilsCrossed className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>Espetinho com precinho especial</span>
          </li>
          <li className="flex items-start gap-3">
            <Beer className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>Bebidas consumidas do local</span>
          </li>
        </ul>

        <label
          htmlFor="event-invite-dont-show-again"
          className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
        >
          <Checkbox
            id="event-invite-dont-show-again"
            checked={dontShowAgain}
            onCheckedChange={(v) => onDontShowAgainChange(v === true)}
          />
          Não exibir novamente
        </label>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Lint**

```bash
pnpm lint
```
Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authenticated\)/_components/event-invite-modal.tsx
git commit -m "feat(event-invite): componente de apresentação do modal de convite"
```

---

## Task 5: Componente `EventInviteTrigger` (client logic)

**Files:**
- Create: `src/app/(authenticated)/_components/event-invite-trigger.tsx`

- [ ] **Step 1: Criar o trigger**

```tsx
"use client";

import { useEffect, useState } from "react";
import { EventInviteModal } from "./event-invite-modal";

const STORAGE_KEY = "bb:event-invite-dismissed-v1";

export function EventInviteTrigger() {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-open após mount no cliente; localStorage não disponível em SSR
    setOpen(true);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && dontShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore quota/availability errors
      }
    }
  }

  return (
    <EventInviteModal
      open={open}
      onOpenChange={handleOpenChange}
      dontShowAgain={dontShowAgain}
      onDontShowAgainChange={setDontShowAgain}
    />
  );
}
```

- [ ] **Step 2: Lint**

```bash
pnpm lint
```
Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authenticated\)/_components/event-invite-trigger.tsx
git commit -m "feat(event-invite): trigger com auto-open e localStorage versionado"
```

---

## Task 6: Montar trigger no `auth-header.tsx`

**Files:**
- Modify: `src/app/(authenticated)/_components/auth-header.tsx`

- [ ] **Step 1: Adicionar import**

Adicionar logo após a linha que importa `PaymentPendingTrigger` (linha 19):

```tsx
import { EventInviteTrigger } from "./event-invite-trigger";
import { getAppSetting } from "@/lib/app-settings";
```

- [ ] **Step 2: Ler o setting no server (lazy)**

No corpo do componente server `AuthHeader`, antes do `return`, adicionar:

```tsx
const eventInviteEnabled = profile.paid
  ? await getAppSetting<boolean>("event_invite_enabled", false)
  : false;
```

(Se a função não for async ainda, marcá-la `async`. Verificar como `profile` é carregado para encontrar o local correto.)

- [ ] **Step 3: Renderizar o trigger**

Logo após a linha 83 (`{!profile.paid && <PaymentPendingTrigger />}`), adicionar:

```tsx
{eventInviteEnabled && <EventInviteTrigger />}
```

- [ ] **Step 4: Verificar build**

```bash
pnpm lint && pnpm build
```
Esperado: build sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(authenticated\)/_components/auth-header.tsx
git commit -m "feat(auth-header): montar EventInviteTrigger quando flag habilitada"
```

---

## Task 7: Server action `setEventInviteEnabled`

**Files:**
- Modify: `src/app/(authenticated)/admin/_actions.ts`

- [ ] **Step 1: Adicionar imports no topo**

Adicionar (se ainda não existirem):

```ts
import { setAppSetting } from "@/lib/app-settings";
```

- [ ] **Step 2: Adicionar a server action ao final do arquivo**

```ts
export async function setEventInviteEnabled(
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "unauthenticated" };

    const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin", {
      uid: user.id,
    });
    if (rpcError) return { ok: false, error: rpcError.message };
    if (!isAdmin) return { ok: false, error: "forbidden" };

    await setAppSetting<boolean>("event_invite_enabled", enabled);

    revalidatePath("/");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
```

- [ ] **Step 3: Lint**

```bash
pnpm lint
```
Esperado: zero erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/admin/_actions.ts
git commit -m "feat(admin): server action setEventInviteEnabled"
```

---

## Task 8: Card `EventInviteToggleCard` no admin

**Files:**
- Create: `src/app/(authenticated)/admin/_components/event-invite-toggle-card.tsx`

- [ ] **Step 1: Criar o card**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { setEventInviteEnabled } from "../_actions";

export function EventInviteToggleCard({
  defaultEnabled,
}: {
  defaultEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [pending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    startTransition(async () => {
      const result = await setEventInviteEnabled(next);
      if (!result.ok) {
        setEnabled(previous);
        toast.error("Não foi possível atualizar o convite.");
        return;
      }
      toast.success(
        next ? "Convite ativado." : "Convite desativado.",
      );
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <h2 className="font-heading text-2xl tracking-wide">Convite do evento</h2>
        <p className="text-sm text-muted-foreground">
          Controla se o modal de convite para o evento Bisteka Bet + Coringas
          aparece para os usuários ao entrar.
        </p>
        <label
          htmlFor="event-invite-enabled"
          className="flex cursor-pointer items-center justify-between gap-3 text-sm"
        >
          <span>Exibir modal de convite</span>
          <Switch
            id="event-invite-enabled"
            checked={enabled}
            disabled={pending}
            onCheckedChange={handleChange}
          />
        </label>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Lint**

```bash
pnpm lint
```
Esperado: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authenticated\)/admin/_components/event-invite-toggle-card.tsx
git commit -m "feat(admin): card com switch para habilitar convite do evento"
```

---

## Task 9: Renderizar o card no `admin/page.tsx`

**Files:**
- Modify: `src/app/(authenticated)/admin/page.tsx`

- [ ] **Step 1: Imports**

Adicionar no topo:

```tsx
import { EventInviteToggleCard } from "./_components/event-invite-toggle-card";
import { getAppSetting } from "@/lib/app-settings";
```

- [ ] **Step 2: Tornar a página async e ler o flag**

Alterar a assinatura `export default function AdminPage()` para `export default async function AdminPage()` e adicionar antes do `return`:

```tsx
const eventInviteEnabled = await getAppSetting<boolean>(
  "event_invite_enabled",
  false,
);
```

- [ ] **Step 3: Renderizar o card na grid**

Dentro da `<section className="mt-8 grid gap-5 lg:grid-cols-2">`, depois do `<ImportResultsCard />`, adicionar:

```tsx
<EventInviteToggleCard defaultEnabled={eventInviteEnabled} />
```

- [ ] **Step 4: Build**

```bash
pnpm lint && pnpm build
```
Esperado: build sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(authenticated\)/admin/page.tsx
git commit -m "feat(admin): renderizar card de toggle do convite de evento"
```

---

## Task 10: Verificação manual end-to-end

**Files:** nenhum

- [ ] **Step 1: Subir o dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Login como admin e abrir `/admin`**

Verificar que o card "Convite do evento" aparece com o switch desligado por default.

- [ ] **Step 3: Ligar o switch**

Toast "Convite ativado." deve aparecer. Recarregar `/admin` — o switch continua ligado.

- [ ] **Step 4: Navegar pra qualquer página autenticada (ex.: `/inicio`) como admin pago**

O modal "Bisteka Bet + Equipe Coringas: Rumo ao hexa!" deve auto-abrir com os dois logos, lista de detalhes e checkbox.

- [ ] **Step 5: Fechar o modal sem marcar o checkbox**

Recarregar a página — o modal **deve abrir de novo**.

- [ ] **Step 6: Reabrir, marcar "Não exibir novamente", fechar**

Recarregar — o modal **não** deve abrir. Verificar no DevTools que
`localStorage["bb:event-invite-dismissed-v1"] === "1"`.

- [ ] **Step 7: Limpar o localStorage e logar como usuário NÃO-pago**

Limpar `bb:event-invite-dismissed-v1`. Trocar para um usuário com `profile.paid = false`. O modal **não** deve aparecer (mas o `PaymentPendingTrigger` sim).

- [ ] **Step 8: Voltar como admin, desligar o switch em `/admin`, limpar localStorage**

Navegar pra `/inicio` — o modal **não** deve aparecer.

- [ ] **Step 9: Commit final (se houver ajustes)**

Se algum ajuste foi necessário durante a verificação, comitar separadamente. Caso contrário, esta task não gera commit.

---

## Resumo de entrega

Ao final, o repositório terá:
- 1 nova migration SQL aplicada (`014_app_settings.sql`).
- 1 novo helper server (`src/lib/app-settings.ts`).
- 1 novo componente shadcn (`Checkbox`).
- 1 novo modal client (`EventInviteModal`) + 1 trigger client (`EventInviteTrigger`).
- 1 nova server action (`setEventInviteEnabled`).
- 1 novo card admin (`EventInviteToggleCard`).
- Edições em `auth-header.tsx` e `admin/page.tsx`.

**Estado default:** flag desligada — nenhum usuário vê o modal até o admin habilitar manualmente.
