# Coleta obrigatória de WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar campo `whatsapp` em `profiles` e bloquear todas as rotas autenticadas com modal não-dismissível enquanto o usuário não preencher o número, salvando como `+55DDDXXXXXXXX` (sem o nono dígito).

**Architecture:** Migração SQL manual cria a coluna `whatsapp` com `unique`, `check` regex e trigger que impede edição pós-preenchimento via UI. Helpers puros (`format` para a máscara visual, `normalize` para o E.164 do banco) ficam em `src/lib/whatsapp/` com testes Vitest. A server action `saveWhatsapp` reusa o `normalize` e mapeia erros do Postgres em mensagens UI. O modal é renderizado condicionalmente no `(authenticated)/layout.tsx` quando `profile.whatsapp === null`, sobrepondo qualquer rota autenticada via portal.

**Tech Stack:** Next.js 16 (proxy.ts, NÃO middleware.ts), React 19 (`useActionState`), Supabase SSR, `@base-ui/react` Dialog (NÃO Radix), Tailwind v4, Vitest (node env, apenas testes em `__tests__/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-05-10-perfil-whatsapp-design.md`

**Convenções do projeto a respeitar:**
- Migrações SQL são aplicadas **manualmente** no Supabase Studio. Não há tooling de migration. Cada arquivo `supabase/sql/NNN_*.sql` é numerado sequencialmente.
- Vitest config (`vitest.config.ts`) só inclui `src/**/__tests__/**/*.test.ts` em ambiente **node** (sem DOM). Logo: testar lógica pura, **não** componentes React.
- Componentes UI usam `@base-ui/react` (não Radix). O Dialog Root aceita `dismissible: boolean` para controlar fechamento por Esc/click fora.
- Cliente Supabase server: `await createClient()` em `src/lib/supabase/server.ts`.

---

## File Structure

**Criar:**
- `supabase/sql/011_profiles_whatsapp.sql` — migração (aplicação manual)
- `src/lib/whatsapp/normalize.ts` — pura: máscara/dígitos → `{ ok, e164 } | { ok: false, reason }`
- `src/lib/whatsapp/format.ts` — pura: dígitos → string formatada `(DD) 9XXXX-XXXX`
- `src/lib/whatsapp/__tests__/normalize.test.ts`
- `src/lib/whatsapp/__tests__/format.test.ts`
- `src/app/(authenticated)/_actions/save-whatsapp.ts` — server action
- `src/app/(authenticated)/_components/whatsapp-input.tsx` — input controlado com máscara
- `src/app/(authenticated)/_components/whatsapp-required-modal.tsx` — modal não-dismissível

**Modificar:**
- `src/types/profile.ts` — adicionar `whatsapp: string | null`
- `src/app/(authenticated)/layout.tsx` — incluir `whatsapp` no `select` + render condicional do modal

**Não tocar:**
- `supabase/sql/001_init_profiles.sql` (a migração 011 só faz `alter table`)
- `src/app/(authenticated)/_components/auth-header.tsx`
- proxy.ts / outras rotas

---

## Task 1: Migração SQL

**Files:**
- Create: `supabase/sql/011_profiles_whatsapp.sql`

- [ ] **Step 1: Criar arquivo SQL**

```sql
-- BistekaBet — coleta obrigatória de WhatsApp
-- Aplicar manualmente no Supabase Studio (SQL Editor) com service role.

alter table public.profiles
  add column whatsapp text unique
    check (whatsapp ~ '^\+55[1-9][0-9][2-9][0-9]{7}$');
-- formato: +55 DDD XXXXXXXX (12 dígitos após o +)
-- DDD: dois dígitos onde o primeiro != 0
-- número: 8 dígitos onde o primeiro != 0/1

create or replace function public.prevent_whatsapp_change() returns trigger
language plpgsql as $$
begin
  -- só permite NULL -> valor (preenchimento inicial pelo próprio usuário).
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

- [ ] **Step 2: Aplicar manualmente no Supabase Studio**

Abrir Supabase Studio → SQL Editor → colar o conteúdo do arquivo → Run.
Verificar:
- Coluna criada: `select column_name, data_type, is_nullable from information_schema.columns where table_name='profiles' and column_name='whatsapp';`
- Constraint check criada: `select conname from pg_constraint where conrelid = 'public.profiles'::regclass and contype='c' and pg_get_constraintdef(oid) like '%whatsapp%';`
- Trigger criada: `select tgname from pg_trigger where tgrelid='public.profiles'::regclass and tgname='profiles_prevent_whatsapp_change';`

- [ ] **Step 3: Commit**

```bash
git add supabase/sql/011_profiles_whatsapp.sql
git commit -m "feat(db): adiciona coluna whatsapp em profiles com unique + trigger anti-edicao"
```

---

## Task 2: Tipo `Profile`

**Files:**
- Modify: `src/types/profile.ts`

- [ ] **Step 1: Adicionar campo `whatsapp`**

Estado final do arquivo:

```ts
// src/types/profile.ts
export type Role = "usuario" | "admin";

export type Profile = {
  id: string;
  role: Role;
  display_name: string;
  avatar_url: string | null;
  whatsapp: string | null;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 2: Verificar compilação**

Rodar `npx tsc --noEmit` — deve falhar em `src/app/(authenticated)/layout.tsx` (o `select` ainda não inclui `whatsapp`). Esse erro será corrigido na Task 7. Outros consumidores do `Profile` (admin/usuarios, auth-header) não dependem do campo, então não devem quebrar — confirmar isso.

Esperado: 1 erro só, em `(authenticated)/layout.tsx` ao tentar `single<Profile>()` retornar tipo sem `whatsapp`. (Pode passar se TS for permissivo com `select` parcial — nesse caso, sem erro.)

- [ ] **Step 3: Commit**

```bash
git add src/types/profile.ts
git commit -m "feat(types): adiciona whatsapp ao tipo Profile"
```

---

## Task 3: Helper de formatação (máscara visual) — TDD

**Files:**
- Create: `src/lib/whatsapp/format.ts`
- Test: `src/lib/whatsapp/__tests__/format.test.ts`

Esse helper transforma uma string de **dígitos crus** (até 11) em uma string visual `(DD) 9XXXX-XXXX` parcialmente formatada, conforme o usuário digita.

- [ ] **Step 1: Escrever os testes (failing)**

Criar `src/lib/whatsapp/__tests__/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatWhatsappMask } from "@/lib/whatsapp/format";

describe("formatWhatsappMask", () => {
  it("vazio retorna vazio", () => {
    expect(formatWhatsappMask("")).toBe("");
  });

  it("1 dígito", () => {
    expect(formatWhatsappMask("1")).toBe("(1");
  });

  it("2 dígitos (DDD completo)", () => {
    expect(formatWhatsappMask("11")).toBe("(11");
  });

  it("3 dígitos abre o número", () => {
    expect(formatWhatsappMask("119")).toBe("(11) 9");
  });

  it("7 dígitos sem hífen ainda", () => {
    expect(formatWhatsappMask("1191234")).toBe("(11) 91234");
  });

  it("8 dígitos coloca o hífen", () => {
    expect(formatWhatsappMask("11912345")).toBe("(11) 91234-5");
  });

  it("11 dígitos (completo)", () => {
    expect(formatWhatsappMask("11912345678")).toBe("(11) 91234-5678");
  });

  it("ignora não-dígitos no input", () => {
    expect(formatWhatsappMask("(11) 91234-5678")).toBe("(11) 91234-5678");
    expect(formatWhatsappMask("a1b1c9")).toBe("(11) 9");
  });

  it("trunca em 11 dígitos", () => {
    expect(formatWhatsappMask("119123456789999")).toBe("(11) 91234-5678");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- src/lib/whatsapp/__tests__/format.test.ts
```
Esperado: erro de import (módulo não existe).

- [ ] **Step 3: Implementar `format.ts`**

Criar `src/lib/whatsapp/format.ts`:

```ts
const DIGITS_RE = /\D/g;

/**
 * Formata uma sequência arbitrária em máscara BR (DD) 9XXXX-XXXX.
 * Trunca em 11 dígitos. Aceita string parcial (formatação progressiva enquanto digita).
 */
export function formatWhatsappMask(input: string): string {
  const digits = input.replace(DIGITS_RE, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 5) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- src/lib/whatsapp/__tests__/format.test.ts
```
Esperado: 9 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/format.ts src/lib/whatsapp/__tests__/format.test.ts
git commit -m "feat(whatsapp): formatWhatsappMask para input progressivo"
```

---

## Task 4: Helper de normalização (E.164) — TDD

**Files:**
- Create: `src/lib/whatsapp/normalize.ts`
- Test: `src/lib/whatsapp/__tests__/normalize.test.ts`

Esse helper recebe a string mascarada (ou crua) e retorna `{ ok: true, e164: '+55DDDXXXXXXXX' }` ou `{ ok: false, reason: 'invalid' }`. Ele é usado pela server action e — opcionalmente no futuro — pelo input para sinalizar validade.

Regras (do spec):
- Após strip de não-dígitos, são exatamente **11 dígitos**.
- Posição 2 (zero-indexed) === `'9'` (nono dígito obrigatório no input).
- DDD (`digits[0..2]`) — primeiro dígito ≠ `'0'`.
- Os 8 dígitos pós-9 — primeiro dígito ≠ `'0'` e ≠ `'1'`.
- Saída: `+55` + DDD + 8 dígitos (descarta o `'9'` do prefixo). Total: `+55` + 10 dígitos = 13 caracteres.

- [ ] **Step 1: Escrever os testes (failing)**

Criar `src/lib/whatsapp/__tests__/normalize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeWhatsapp } from "@/lib/whatsapp/normalize";

describe("normalizeWhatsapp", () => {
  it("aceita máscara completa e retorna E.164 sem o 9", () => {
    expect(normalizeWhatsapp("(11) 91234-5678")).toEqual({
      ok: true,
      e164: "+551112345678",
    });
  });

  it("aceita dígitos crus", () => {
    expect(normalizeWhatsapp("11912345678")).toEqual({
      ok: true,
      e164: "+551112345678",
    });
  });

  it("ignora espaços e pontuação", () => {
    expect(normalizeWhatsapp("+55 (11) 9 1234-5678")).toEqual({
      ok: true,
      e164: "+551112345678",
    });
  });

  it("rejeita menos de 11 dígitos", () => {
    expect(normalizeWhatsapp("1112345678")).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejeita mais de 11 dígitos", () => {
    expect(normalizeWhatsapp("119123456789")).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejeita ausência do nono dígito", () => {
    // 11 dígitos mas o 3o (índice 2) é 8, não 9
    expect(normalizeWhatsapp("11812345678")).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejeita DDD começando com 0", () => {
    expect(normalizeWhatsapp("01912345678")).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejeita número começando com 0 após o 9", () => {
    expect(normalizeWhatsapp("11901234567")).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejeita número começando com 1 após o 9", () => {
    expect(normalizeWhatsapp("11911234567")).toEqual({ ok: false, reason: "invalid" });
  });

  it("aceita primeiro dígito 2-9 após o 9", () => {
    expect(normalizeWhatsapp("11922345678")).toEqual({ ok: true, e164: "+551122345678" });
    expect(normalizeWhatsapp("11992345678")).toEqual({ ok: true, e164: "+551192345678" });
  });

  it("vazio é inválido", () => {
    expect(normalizeWhatsapp("")).toEqual({ ok: false, reason: "invalid" });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- src/lib/whatsapp/__tests__/normalize.test.ts
```
Esperado: erro de import.

- [ ] **Step 3: Implementar `normalize.ts`**

Criar `src/lib/whatsapp/normalize.ts`:

```ts
const DIGITS_RE = /\D/g;

export type NormalizeResult =
  | { ok: true; e164: string }
  | { ok: false; reason: "invalid" };

/**
 * Recebe input bruto ou mascarado e retorna E.164 BR sem o nono dígito.
 * Esperado: 11 dígitos (DDD + 9 + 8). Saída: +55 + DDD + 8 (13 chars).
 */
export function normalizeWhatsapp(input: string): NormalizeResult {
  const digits = input.replace(DIGITS_RE, "");
  if (digits.length !== 11) return { ok: false, reason: "invalid" };
  if (digits[2] !== "9") return { ok: false, reason: "invalid" };
  const ddd = digits.slice(0, 2);
  const eight = digits.slice(3);
  if (ddd[0] === "0") return { ok: false, reason: "invalid" };
  if (eight[0] === "0" || eight[0] === "1") return { ok: false, reason: "invalid" };
  return { ok: true, e164: `+55${ddd}${eight}` };
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
npm test -- src/lib/whatsapp/__tests__/normalize.test.ts
```
Esperado: 11 testes passando.

- [ ] **Step 5: Rodar suite completa**

```bash
npm test
```
Esperado: tudo verde. Garante que nada antigo quebrou.

- [ ] **Step 6: Commit**

```bash
git add src/lib/whatsapp/normalize.ts src/lib/whatsapp/__tests__/normalize.test.ts
git commit -m "feat(whatsapp): normalizeWhatsapp valida e converte para E.164 BR"
```

---

## Task 5: Server action `saveWhatsapp`

**Files:**
- Create: `src/app/(authenticated)/_actions/save-whatsapp.ts`

A action recebe `FormData`, chama `normalizeWhatsapp`, faz `update` em `profiles` somente quando `whatsapp is null` (anti-race), e mapeia códigos do Postgres em erros amigáveis. Não tem teste unitário — depende do client Supabase real e é coberto na QA manual.

- [ ] **Step 1: Implementar a action**

Criar `src/app/(authenticated)/_actions/save-whatsapp.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeWhatsapp } from "@/lib/whatsapp/normalize";

export type SaveWhatsappResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "duplicate" | "unauthenticated" | "unknown" };

export async function saveWhatsapp(
  _prevState: SaveWhatsappResult | null,
  formData: FormData,
): Promise<SaveWhatsappResult> {
  const raw = String(formData.get("whatsapp") ?? "");
  const result = normalizeWhatsapp(raw);
  if (!result.ok) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ whatsapp: result.e164 })
    .eq("id", user.id)
    .is("whatsapp", null);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "duplicate" };
    if (error.code === "23514") return { ok: false, error: "invalid" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
```

Notas:
- Assinatura `(prevState, formData)` é o contrato esperado por `useActionState` do React 19.
- `prevState` vem ignorado (`_prevState`).
- `revalidatePath("/", "layout")` invalida o layout autenticado e força nova leitura do profile.

- [ ] **Step 2: Verificar tipo**

```bash
npx tsc --noEmit
```
Esperado: sem novos erros relacionados a este arquivo.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authenticated\)/_actions/save-whatsapp.ts
git commit -m "feat(perfil): server action saveWhatsapp valida e persiste numero"
```

(No Windows o `(`/`)` precisa de escape no shell. Se estiver no PowerShell, use aspas: `git add 'src/app/(authenticated)/_actions/save-whatsapp.ts'`.)

---

## Task 6: Componente `WhatsappInput`

**Files:**
- Create: `src/app/(authenticated)/_components/whatsapp-input.tsx`

Input controlado que aplica `formatWhatsappMask` no `onChange`. Expõe `value` (string mascarada) e `onChange(value)`. O modal pai mantém o estado e usa o valor diretamente no `FormData`.

- [ ] **Step 1: Implementar o componente**

Criar `src/app/(authenticated)/_components/whatsapp-input.tsx`:

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatWhatsappMask } from "@/lib/whatsapp/format";

interface Props {
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  describedById?: string;
  disabled?: boolean;
}

export function WhatsappInput({
  value,
  onChange,
  invalid,
  describedById,
  disabled,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="whatsapp">WhatsApp</Label>
      <Input
        id="whatsapp"
        name="whatsapp"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        autoFocus
        placeholder="(11) 91234-5678"
        value={value}
        onChange={(e) => onChange(formatWhatsappMask(e.target.value))}
        aria-invalid={invalid || undefined}
        aria-describedby={describedById}
        disabled={disabled}
        className={cn("h-12 text-base", invalid && "border-destructive")}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipo**

```bash
npx tsc --noEmit
```
Esperado: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(authenticated)/_components/whatsapp-input.tsx'
git commit -m "feat(perfil): WhatsappInput com mascara progressiva"
```

---

## Task 7: Componente `WhatsappRequiredModal`

**Files:**
- Create: `src/app/(authenticated)/_components/whatsapp-required-modal.tsx`

Modal não-dismissível usando o `Dialog` do shadcn (que envolve `@base-ui/react`). Pontos críticos:

- `<Dialog open dismissible={false}>` — o prop `dismissible` do base-ui Root impede Esc/click fora. **NÃO** existe `onOpenChange` aqui; o componente nunca recebe sinal pra fechar.
- `<DialogContent showCloseButton={false}>` — remove o X.
- React 19 `useActionState` ligado a `saveWhatsapp`.
- Estado local: `value` (mascarado).
- Em sucesso, o `revalidatePath` do servidor vai re-renderizar o layout sem o modal — não precisamos fazer nada manual no client.

- [ ] **Step 1: Implementar o modal**

Criar `src/app/(authenticated)/_components/whatsapp-required-modal.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  saveWhatsapp,
  type SaveWhatsappResult,
} from "../_actions/save-whatsapp";
import { WhatsappInput } from "./whatsapp-input";

const ERROR_COPY: Record<
  Exclude<SaveWhatsappResult, { ok: true }>["error"],
  string
> = {
  invalid: "Número inválido. Use (DDD) 9XXXX-XXXX.",
  duplicate: "Esse número já foi cadastrado por outro participante.",
  unauthenticated: "Sessão expirou. Recarregue a página.",
  unknown: "Erro ao salvar. Tente novamente.",
};

export function WhatsappRequiredModal() {
  const [value, setValue] = useState("");
  const [state, formAction, pending] = useActionState<
    SaveWhatsappResult | null,
    FormData
  >(saveWhatsapp, null);

  const errorMessage =
    state && !state.ok ? ERROR_COPY[state.error] : null;

  // 11 dígitos pra habilitar o submit
  const digits = value.replace(/\D/g, "");
  const canSubmit = digits.length === 11 && !pending;

  return (
    <Dialog open dismissible={false}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] gap-5"
      >
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-14 items-center justify-center overflow-hidden rounded-xl bg-secondary ring-1 ring-border sm:size-16">
            <Image
              src="/BISTECA.png"
              alt=""
              width={64}
              height={64}
              priority
              className="size-14 object-contain sm:size-16"
            />
          </span>
          <DialogTitle className="text-center font-heading text-xl uppercase tracking-wide">
            Falta um detalhe pra entrar no grupo
          </DialogTitle>
          <DialogDescription className="text-center leading-relaxed">
            Pra te adicionar ao grupo do WhatsApp do bolão (avisos de jogos,
            palpites e ranking), precisamos do seu número.
          </DialogDescription>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <WhatsappInput
            value={value}
            onChange={setValue}
            invalid={Boolean(errorMessage)}
            describedById={errorMessage ? "whatsapp-error" : undefined}
            disabled={pending}
          />

          {errorMessage && (
            <p
              id="whatsapp-error"
              role="alert"
              aria-live="polite"
              className="text-sm text-destructive"
            >
              {errorMessage}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={!canSubmit}
            className="h-12 text-base font-semibold"
          >
            {pending ? "Salvando..." : "Salvar e continuar"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Seu número fica visível só pra organização do bolão.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verificar tipo**

```bash
npx tsc --noEmit
```
Esperado: sem erros novos. Se aparecer erro sobre `dismissible` no `<Dialog>`, é porque o tipo `Dialog.Root.Props` do base-ui foi atualizado. Conferir com `node_modules/@base-ui/react/dist/dialog/root/DialogRoot.d.ts` qual o nome certo do prop.

- [ ] **Step 3: Verificar prop `dismissible` existe**

```bash
grep -rn "dismissible" node_modules/@base-ui/react/dist/dialog 2>/dev/null | head
```
Se não aparecer, conferir o tipo `DialogPrimitive.Root.Props` em `node_modules/@base-ui/react/dist/dialog/root/DialogRoot.d.ts` para descobrir o nome real (alternativas comuns: `modal`, `closeOnEscape`, `closeOnInteractOutside`). Ajustar o componente.

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(authenticated)/_components/whatsapp-required-modal.tsx'
git commit -m "feat(perfil): WhatsappRequiredModal nao-dismissivel"
```

---

## Task 8: Wire-up no `(authenticated)/layout.tsx`

**Files:**
- Modify: `src/app/(authenticated)/layout.tsx`

Duas mudanças: incluir `whatsapp` no `select` e renderizar o modal condicionalmente fora do `<div>` de children.

- [ ] **Step 1: Editar o layout**

Estado final esperado:

```tsx
// src/app/(authenticated)/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profile";
import { Toaster } from "@/components/ui/sonner";
import { AuthHeader } from "./_components/auth-header";
import { WhatsappRequiredModal } from "./_components/whatsapp-required-modal";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, role, display_name, avatar_url, whatsapp, created_at, updated_at",
    )
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
}
```

A única mudança no `select` é a adição de `whatsapp,`. O resto fica igual ao arquivo atual.

- [ ] **Step 2: Verificar build**

```bash
npx tsc --noEmit
```
Esperado: sem erros.

```bash
npm run lint
```
Esperado: sem erros novos.

- [ ] **Step 3: Rodar suite de testes completa**

```bash
npm test
```
Esperado: tudo verde.

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(authenticated)/layout.tsx'
git commit -m "feat(perfil): renderiza WhatsappRequiredModal quando whatsapp e null"
```

---

## Task 9: QA manual

**Pré-condição:** Migração SQL da Task 1 já aplicada no banco (Studio).

- [ ] **Step 1: Subir o dev server**

```bash
npm run dev
```

- [ ] **Step 2: Cenário "usuário sem WhatsApp"**

Como admin (via SQL): `update profiles set whatsapp = null where id = '<seu-id>';`
Recarregar a aplicação autenticada.
Verificar:
- Modal aparece centralizado em `/inicio`.
- Pressionar `Esc` → não fecha.
- Clicar fora do modal → não fecha.
- Não existe botão X.
- Tentativa de submit com input vazio: botão `disabled`.
- Tentativa com 10 dígitos (sem o 9): botão `disabled` (input ainda incompleto pra máscara).
- Inserir um número que **outro perfil** já tenha (preparar via SQL): erro inline "já foi cadastrado".
- Inserir um número válido: modal some, página onde estava continua visível, sem redirecionamento.

- [ ] **Step 3: Cenário "rota sem ser /inicio"**

Repetir o reset do whatsapp via SQL. Acessar diretamente `/palpites`, `/classificacao`, `/regulamento`, `/admin` (se for admin).
Verificar: modal sobrepõe cada uma dessas rotas igualzinho.

- [ ] **Step 4: Cenário admin não isento**

Como admin sem whatsapp, navegar em `/admin`.
Verificar: modal aparece, admin é bloqueado.

- [ ] **Step 5: Mobile (dev tools, viewport 375×667)**

- Logo aparece no topo.
- Input não causa zoom no foco (font-size ≥16px).
- Botão "Salvar e continuar" tem altura confortável (h-12).
- Backdrop cobre 100vh.
- Conteúdo cabe sem scroll interno.

- [ ] **Step 6: Cenário "valor já preenchido"**

Garantir que o profile tem `whatsapp` set. Acessar qualquer rota autenticada.
Verificar: modal **não** aparece em nenhuma página.

- [ ] **Step 7: Sem commit**

Esta task é só validação manual. Se algum cenário falhar, voltar à task correspondente, corrigir, recomeçar a QA.

---

## Notas finais

- **Nada na admin/usuarios:** o spec deixou explícito que mostrar o número na tela do admin é follow-up. Não tocar nessa tela neste plano.
- **Migração não-automatizada:** se o banco de produção/preview não tiver a coluna, a app vai quebrar no `select`. Aplicar a Task 1 antes de fazer deploy.
- **`useActionState` é React 19:** o projeto já usa React 19.2.4, então o hook está disponível. Caso o lint reclame de import, conferir versão.
- **Convenção do `@base-ui` Dialog:** se a propriedade pra desabilitar o dismiss no `Dialog.Root` tiver outro nome na versão atual, ajustar e re-testar Esc/click fora.
