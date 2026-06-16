# Toggle de lembrete por WhatsApp na home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um toggle na home (`/inicio`) para o usuário ligar/desligar o lembrete via WhatsApp 15min antes do jogo, com persistência em `profiles.notify_whatsapp` e filtro correspondente na RPC consumida pelo workflow n8n.

**Architecture:** Nova coluna booleana `notify_whatsapp` em `public.profiles` (default `true` → opt-in para todos). UI Client Component com save otimista via Server Action que faz `update` no Supabase. RPC `list_pending_predict_reminders_15m` atualizada via `CREATE OR REPLACE` adicionando o predicado `notify_whatsapp = true` ao filtro.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (`@supabase/ssr`), TypeScript, TailwindCSS, shadcn/ui (`Switch` baseado em `@base-ui/react`), sonner.

**Spec:** `docs/superpowers/specs/2026-06-16-whatsapp-reminder-toggle-design.md`

---

## File Structure

**Create:**

- `supabase/sql/017_profiles_notify_whatsapp.sql` — migration da nova coluna.
- `supabase/sql/018_list_pending_predict_reminders_15m_notify_filter.sql` — `CREATE OR REPLACE` da RPC com o filtro novo.
- `src/app/(authenticated)/_actions/save-notify-whatsapp.ts` — Server Action.
- `src/app/(authenticated)/inicio/_components/whatsapp-reminder-toggle.tsx` — Client Component.

**Modify:**

- `src/types/profile.ts` — adicionar `notify_whatsapp: boolean`.
- `src/app/(authenticated)/layout.tsx` — incluir `notify_whatsapp` no `select`.
- `src/app/(authenticated)/inicio/_components/upcoming-matches-section.tsx` — carregar `notify_whatsapp` do user, renderizar `<WhatsappReminderToggle />` no `<CardHeader>` abaixo do `<CardTitle>`.

---

## Task 1: Migration da coluna `notify_whatsapp`

**Files:**
- Create: `supabase/sql/017_profiles_notify_whatsapp.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- BistekaBet — opt-in/opt-out de lembrete WhatsApp
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.
--
-- default true cobre opt-in tanto para usuários novos quanto para os
-- existentes (o default é aplicado às linhas atuais durante o ALTER TABLE).
-- O próprio usuário deve poder mudar este campo livremente — diferente de
-- whatsapp/role, não exige trigger nem service role. As policies existentes
-- (profiles_update_own) cobrem a permissão.

alter table public.profiles
  add column notify_whatsapp boolean not null default true;
```

- [ ] **Step 2: Aplicar o SQL no Supabase Studio**

No Supabase Studio → SQL Editor, colar e rodar o conteúdo de `017_profiles_notify_whatsapp.sql`.

Validar com:

```sql
select count(*) as total, count(*) filter (where notify_whatsapp = true) as opted_in
from public.profiles;
```

Esperado: `total == opted_in` (todos os usuários começam optados).

- [ ] **Step 3: Commit**

```bash
git add supabase/sql/017_profiles_notify_whatsapp.sql
git commit -m "feat(profiles): coluna notify_whatsapp para opt-in de lembrete WhatsApp"
```

---

## Task 2: Atualizar tipo `Profile` e select no layout

**Files:**
- Modify: `src/types/profile.ts`
- Modify: `src/app/(authenticated)/layout.tsx`

- [ ] **Step 1: Adicionar campo no tipo `Profile`**

Em `src/types/profile.ts`, adicionar `notify_whatsapp` após `whatsapp`:

```ts
export type Profile = {
  id: string;
  role: Role;
  display_name: string;
  avatar_url: string | null;
  whatsapp: string | null;
  notify_whatsapp: boolean;
  paid: boolean;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 2: Atualizar o `select` no layout autenticado**

Em `src/app/(authenticated)/layout.tsx`, na string de `.select(...)`, incluir `notify_whatsapp`:

```ts
.select("id, role, display_name, avatar_url, whatsapp, notify_whatsapp, paid, created_at, updated_at")
```

- [ ] **Step 3: Verificar build/typecheck**

```bash
npm run lint
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/types/profile.ts "src/app/(authenticated)/layout.tsx"
git commit -m "feat(profiles): tipar notify_whatsapp e incluir no select do layout"
```

---

## Task 3: Server Action `saveNotifyWhatsapp`

**Files:**
- Create: `src/app/(authenticated)/_actions/save-notify-whatsapp.ts`

- [ ] **Step 1: Criar o arquivo da Server Action**

```ts
"use server";

import { createClient } from "@/lib/supabase/server";

export type SaveNotifyWhatsappResult =
  | { ok: true }
  | { ok: false; error: "unauthenticated" | "unknown" };

export async function saveNotifyWhatsapp(
  enabled: boolean,
): Promise<SaveNotifyWhatsappResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ notify_whatsapp: enabled })
    .eq("id", user.id);

  if (error) return { ok: false, error: "unknown" };
  return { ok: true };
}
```

Notas:
- Sem `revalidatePath` — o toggle é state local; o profile relê na próxima navegação naturalmente.
- Sem validação custom: boolean é boolean.
- Confiamos nas RLS policies de `profiles_update_own` para barrar updates indevidos.

- [ ] **Step 2: Verificar build/typecheck**

```bash
npm run lint
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authenticated)/_actions/save-notify-whatsapp.ts"
git commit -m "feat(actions): saveNotifyWhatsapp para opt-in/out de lembrete"
```

---

## Task 4: Componente `WhatsappReminderToggle`

**Files:**
- Create: `src/app/(authenticated)/inicio/_components/whatsapp-reminder-toggle.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";

import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { saveNotifyWhatsapp } from "@/app/(authenticated)/_actions/save-notify-whatsapp";

type Props = {
  initialEnabled: boolean;
};

export function WhatsappReminderToggle({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [, startTransition] = useTransition();

  function handleChange(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    startTransition(async () => {
      const result = await saveNotifyWhatsapp(next);
      if (!result.ok) {
        setEnabled(previous);
        toast.error("Não foi possível salvar");
      }
    });
  }

  return (
    <label
      htmlFor="whatsapp-reminder-toggle"
      className="flex cursor-pointer items-center justify-between gap-3 text-sm"
    >
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <MessageCircle className="size-4" aria-hidden />
        Lembrete por WhatsApp
      </span>
      <Switch
        id="whatsapp-reminder-toggle"
        checked={enabled}
        onCheckedChange={handleChange}
        aria-label="Lembrete por WhatsApp"
      />
    </label>
  );
}
```

Notas:
- Pattern de save otimista replica o `EventInviteToggleCard` (`src/app/(authenticated)/admin/_components/event-invite-toggle-card.tsx`), exceto que aqui não há toast de sucesso e o Switch **não** fica `disabled` durante a transição — spec define `último venceu` (último estado clicado persiste).
- Sucesso silencioso: o próprio toggle responder visualmente é feedback.
- Label envolve span+Switch — clique no texto também alterna.

- [ ] **Step 2: Verificar build/typecheck**

```bash
npm run lint
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authenticated)/inicio/_components/whatsapp-reminder-toggle.tsx"
git commit -m "feat(inicio): componente WhatsappReminderToggle"
```

---

## Task 5: Wire-up no `UpcomingMatchesSection`

**Files:**
- Modify: `src/app/(authenticated)/inicio/_components/upcoming-matches-section.tsx`

- [ ] **Step 1: Carregar `notify_whatsapp` e renderizar o toggle**

Substituir o conteúdo de `upcoming-matches-section.tsx` por:

```tsx
import { CalendarDays } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatSaoPauloDayLabel } from "@/lib/dates/sao-paulo-day";
import { getInicioDayMatches } from "../_lib/queries";
import { UpcomingMatchesList } from "./upcoming-matches-list";
import { WhatsappReminderToggle } from "./whatsapp-reminder-toggle";

export async function UpcomingMatchesSection() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const [{ matches, referenceDate, isToday }, profileRes] = await Promise.all([
    getInicioDayMatches(supabase, userData.user.id),
    supabase
      .from("profiles")
      .select("notify_whatsapp")
      .eq("id", userData.user.id)
      .single<{ notify_whatsapp: boolean }>(),
  ]);

  const notifyWhatsapp = profileRes.data?.notify_whatsapp ?? true;

  const dayLabel = referenceDate
    ? formatSaoPauloDayLabel(referenceDate, { isToday })
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <CardTitle className="inline-flex items-center gap-2 font-heading text-xl tracking-wide">
          <CalendarDays className="size-5 text-primary" />
          Próximos jogos
        </CardTitle>
        <WhatsappReminderToggle initialEnabled={notifyWhatsapp} />
      </CardHeader>
      <CardContent>
        <UpcomingMatchesList matches={matches} dayLabel={dayLabel} />
      </CardContent>
    </Card>
  );
}
```

Notas:
- `Promise.all` paraleliza as duas queries — custo agregado é o da mais lenta.
- Fallback `?? true` defensivo se a query falhar (não deve acontecer; o usuário já foi resolvido acima).
- `flex-col gap-3` no `<CardHeader>` empilha título + toggle verticalmente. O shadcn `CardHeader` padrão já é flex; só ajustamos a direção.
- Toggle sempre visível, independente de haver jogos.

- [ ] **Step 2: Rodar dev e validar visualmente**

```bash
npm run dev
```

Abrir `http://localhost:3000/inicio` autenticado. Confirmar:
- Toggle aparece abaixo do título "Próximos jogos".
- Vem ligado.
- Clicar desliga; recarregar a página → permanece desligado.
- Ligar de novo; recarregar → permanece ligado.

- [ ] **Step 3: Verificar build/typecheck**

```bash
npm run lint
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authenticated)/inicio/_components/upcoming-matches-section.tsx"
git commit -m "feat(inicio): toggle de lembrete WhatsApp no card Próximos jogos"
```

---

## Task 6: Migration da RPC `list_pending_predict_reminders_15m`

**Files:**
- Create: `supabase/sql/018_list_pending_predict_reminders_15m_notify_filter.sql`

- [ ] **Step 1: Capturar a definição atual da função no Supabase**

No Supabase Studio → SQL Editor, rodar:

```sql
select pg_get_functiondef(oid)
from pg_proc
where proname = 'list_pending_predict_reminders_15m'
  and pronamespace = 'public'::regnamespace;
```

Copiar o resultado integral (já vem como `CREATE OR REPLACE FUNCTION ...`).

- [ ] **Step 2: Criar o arquivo de migration com o filtro novo**

Em `supabase/sql/018_list_pending_predict_reminders_15m_notify_filter.sql`, colar a definição capturada e **adicionar o predicado** `p.notify_whatsapp = true` ao `WHERE` do corpo da função. O alias `p` é o usado para `profiles` — se estiver diferente (ex: `pr`), ajustar conforme a função existente.

Cabeçalho sugerido para o arquivo:

```sql
-- BistekaBet — filtro de opt-in WhatsApp na RPC de lembrete 15min
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.
-- Pré-requisito: migration 017 (coluna profiles.notify_whatsapp).
--
-- Acrescenta o predicado `notify_whatsapp = true` ao filtro existente para
-- que o workflow n8n só receba como alvos os usuários que aceitaram receber
-- lembretes por WhatsApp. Colunas retornadas e assinatura permanecem
-- idênticas — n8n não precisa de ajuste.

-- ↓ colar aqui a definição completa retornada por pg_get_functiondef, com
--   o predicado `<alias_profiles>.notify_whatsapp = true` adicionado ao WHERE.
```

- [ ] **Step 3: Aplicar o SQL no Supabase Studio**

Rodar o arquivo no SQL Editor. Validar com:

```sql
-- A função existe, está com search_path/security configurados como antes
\df+ public.list_pending_predict_reminders_15m
-- ou via select:
select prosrc from pg_proc where proname = 'list_pending_predict_reminders_15m';
```

Confirmar que o corpo tem `notify_whatsapp = true`.

- [ ] **Step 4: Validar end-to-end o filtro**

No SQL Editor:

```sql
-- pegar um usuário e marcar opt-out
update public.profiles set notify_whatsapp = false where id = '<uuid_de_teste>';

-- rodar a RPC e confirmar que o usuário NÃO aparece
select * from public.list_pending_predict_reminders_15m();

-- restaurar
update public.profiles set notify_whatsapp = true where id = '<uuid_de_teste>';
```

(Se não houver match em janela ativa de 15min no momento, o teste fica trivial — `update`+`select` ainda comprova que o predicado está no WHERE; o run real do workflow é validado quando houver partida próxima.)

- [ ] **Step 5: Commit**

```bash
git add supabase/sql/018_list_pending_predict_reminders_15m_notify_filter.sql
git commit -m "feat(rpc): filtrar notify_whatsapp=true em list_pending_predict_reminders_15m"
```

---

## Task 7: Validação manual end-to-end

- [ ] **Step 1: Validar persistência**

Em `/inicio`:
- Toggle vem ligado.
- Desligar → recarregar → permanece desligado.
- Ligar → recarregar → permanece ligado.

- [ ] **Step 2: Validar revert otimista**

Em devtools, ativar "Offline" no Network tab.
- Alternar o toggle → deve aparecer ligado/desligado instantaneamente, depois reverter ao estado anterior, e exibir toast "Não foi possível salvar".
- Desativar o "Offline" e repetir → save normal.

- [ ] **Step 3: Validar acessibilidade básica**

- Foco via Tab no Switch funciona.
- Espaço/Enter alterna o estado.

- [ ] **Step 4: Validar workflow n8n**

Quando houver uma partida com kickoff entre 14 e 16 minutos no futuro e um usuário com palpite pendente:
- Marcar o usuário com `notify_whatsapp = false` no Studio.
- Disparar o workflow manualmente (`Test workflow` no n8n).
- Confirmar que o usuário não aparece no resultado da RPC nem recebe mensagem.
- Restaurar `notify_whatsapp = true`.

---
