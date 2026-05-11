# Modal de pagamento pendente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renderizar no header da área autenticada um botão (desktop) / ícone (mobile) que, para usuários com `paid = false`, abre um modal dismissível com QR Code Pix, código copia-e-cola e link de aviso pelo WhatsApp. Abre automaticamente 1x por sessão.

**Architecture:** Três novos componentes client em `src/app/(authenticated)/_components/`. O layout server inclui `paid` no select do Supabase e passa para o `AuthHeader`. O trigger gerencia `sessionStorage` para auto-open e abertura manual via botão.

**Tech Stack:** Next.js 16, React 19, shadcn/ui Dialog, lucide-react, sonner (toasts), Tailwind v4. Sem testes unitários novos — o padrão do projeto é testar lógica em `src/lib/**/__tests__/`; este feature é puramente apresentacional.

**Spec:** `docs/superpowers/specs/2026-05-11-modal-pagamento-pendente-design.md`

---

## File Structure

**Criados:**
- `src/app/(authenticated)/_components/copy-pix-button.tsx` — preview 12 chars + botão copiar com toast.
- `src/app/(authenticated)/_components/payment-pending-modal.tsx` — `Dialog` apresentacional, recebe `open`/`onOpenChange`.
- `src/app/(authenticated)/_components/payment-pending-trigger.tsx` — botão no header + estado do modal + auto-open via `sessionStorage`.

**Modificados:**
- `src/types/profile.ts` — adicionar `paid: boolean`.
- `src/app/(authenticated)/layout.tsx` — incluir `paid` no `.select(...)`.
- `src/app/(authenticated)/_components/auth-header.tsx` — receber `paid` (via `Profile`) e renderizar trigger condicional.
- `.env.local` — renomear `QR_CODE_PAY` para `NEXT_PUBLIC_QR_CODE_PAY` (manual, fora do diff).
- `.env.local.example` — idem.

---

## Task 1: Adicionar `paid` ao tipo `Profile` e ao select do layout

**Files:**
- Modify: `src/types/profile.ts`
- Modify: `src/app/(authenticated)/layout.tsx`

- [ ] **Step 1: Adicionar `paid` ao tipo**

Editar `src/types/profile.ts`:

```ts
export type Profile = {
  id: string;
  role: Role;
  display_name: string;
  avatar_url: string | null;
  whatsapp: string | null;
  paid: boolean;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 2: Incluir `paid` no select do layout**

Em `src/app/(authenticated)/layout.tsx`, atualizar o `.select(...)` (linha ~22):

```ts
.select("id, role, display_name, avatar_url, whatsapp, paid, created_at, updated_at")
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros novos. Se algum consumidor de `Profile` quebrar por causa do campo obrigatório, será nas mensagens — provavelmente nada além do que já compila, pois é uma adição.

- [ ] **Step 4: Commit**

```bash
git add src/types/profile.ts src/app/(authenticated)/layout.tsx
git commit -m "feat(profile): incluir campo paid no tipo e no select do layout"
```

---

## Task 2: Renomear variável de ambiente para `NEXT_PUBLIC_QR_CODE_PAY`

**Files:**
- Modify: `.env.local` (manual — não versionado)
- Modify: `.env.local.example`

- [ ] **Step 1: Atualizar `.env.local.example`**

Substituir a linha `QR_CODE_PAY=` por:

```
NEXT_PUBLIC_QR_CODE_PAY=
```

- [ ] **Step 2: Atualizar `.env.local` (manual)**

Pedir ao usuário (ou ele mesmo já vai): renomear `QR_CODE_PAY=...` para `NEXT_PUBLIC_QR_CODE_PAY=...` com o mesmo valor. Sem esse passo, o modal mostra apenas o QR e botão WhatsApp.

- [ ] **Step 3: Buscar usos antigos**

Run (via Grep tool, não bash): pattern `QR_CODE_PAY`, glob `**/*.{ts,tsx}`.
Expected: nenhum match em código (a var ainda não estava em uso). Se houver, atualizar.

- [ ] **Step 4: Commit**

```bash
git add .env.local.example
git commit -m "chore(env): expor QR_CODE_PAY como NEXT_PUBLIC_QR_CODE_PAY"
```

---

## Task 3: Componente `CopyPixButton`

**Files:**
- Create: `src/app/(authenticated)/_components/copy-pix-button.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyPixButton({ code }: { code: string }) {
  const preview = code.slice(0, 12);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código Pix copiado");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
      <code className="flex-1 truncate font-mono text-xs text-muted-foreground">
        {preview}…
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="shrink-0"
      >
        <Copy className="size-4" />
        Copiar
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(authenticated)/_components/copy-pix-button.tsx
git commit -m "feat(payment-modal): CopyPixButton com preview e toast"
```

---

## Task 4: Componente `PaymentPendingModal`

**Files:**
- Create: `src/app/(authenticated)/_components/payment-pending-modal.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";

import Image from "next/image";
import { MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { INSCRIPTION_VALUE_BRL, formatBRL } from "@/lib/bolao-config";
import { CopyPixButton } from "./copy-pix-button";

const WHATSAPP_HREF =
  "https://wa.me/554799680801?text=Olá!%20Acabei%20de%20pagar%20a%20inscrição%20do%20Bisteka%20Bet.";

export function PaymentPendingModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pixCode = process.env.NEXT_PUBLIC_QR_CODE_PAY ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5 p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-14 items-center justify-center overflow-hidden rounded-xl bg-secondary ring-1 ring-border sm:size-16">
            <Image
              src="/BISTECA.png"
              alt=""
              width={64}
              height={64}
              className="size-14 object-contain sm:size-16"
            />
          </span>
          <DialogTitle className="text-center font-heading text-xl uppercase tracking-wide">
            Inscrição pendente
          </DialogTitle>
          <DialogDescription className="text-center leading-relaxed">
            Você ainda não confirmou o pagamento da sua inscrição no bolão.
            Pague via Pix e nos avise pelo WhatsApp.
          </DialogDescription>
        </div>

        <p className="text-center font-heading text-3xl tracking-wide text-primary">
          {formatBRL(INSCRIPTION_VALUE_BRL)}
        </p>

        <div className="flex justify-center">
          <Image
            src="/qrcodepix.png"
            alt="QR Code Pix"
            width={220}
            height={220}
            className="rounded-md ring-1 ring-border"
          />
        </div>

        {pixCode && <CopyPixButton code={pixCode} />}

        <Button asChild size="lg" className="h-12 text-base font-semibold">
          <a href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-5" />
            Já paguei, avisar no WhatsApp
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(authenticated)/_components/payment-pending-modal.tsx
git commit -m "feat(payment-modal): modal dismissível com QR Pix e CTA WhatsApp"
```

---

## Task 5: Componente `PaymentPendingTrigger`

**Files:**
- Create: `src/app/(authenticated)/_components/payment-pending-trigger.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";

import { useEffect, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentPendingModal } from "./payment-pending-modal";

const SESSION_KEY = "bb:payment-modal-seen";

export function PaymentPendingTrigger() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    sessionStorage.setItem(SESSION_KEY, "1");
    setOpen(true);
  }, []);

  return (
    <>
      {/* Desktop */}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex"
      >
        <CircleDollarSign className="size-4" />
        Pagar inscrição
      </Button>

      {/* Mobile */}
      <Button
        type="button"
        variant="destructive"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Pagamento pendente"
        className="relative inline-flex md:hidden"
      >
        <CircleDollarSign className="size-5" />
        <span
          aria-hidden
          className="absolute right-1 top-1 size-2 rounded-full bg-background ring-2 ring-destructive"
        />
      </Button>

      <PaymentPendingModal open={open} onOpenChange={setOpen} />
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/(authenticated)/_components/payment-pending-trigger.tsx
git commit -m "feat(payment-modal): trigger com auto-open por sessão e botão manual"
```

---

## Task 6: Integrar trigger no `AuthHeader`

**Files:**
- Modify: `src/app/(authenticated)/_components/auth-header.tsx`

- [ ] **Step 1: Importar trigger**

No topo do arquivo, adicionar:

```ts
import { PaymentPendingTrigger } from "./payment-pending-trigger";
```

- [ ] **Step 2: Renderizar condicional antes do avatar**

Localizar o `<DropdownMenu>` (linha ~82) e inserir imediatamente antes dele, dentro do mesmo `<div>` flex:

```tsx
{!profile.paid && <PaymentPendingTrigger />}

<DropdownMenu>
  …
```

A classe `gap-6` do container pai já dá espaçamento. Se ficar apertado, ajustar com `gap-3` no container interno do trigger — verificar visualmente.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/(authenticated)/_components/auth-header.tsx
git commit -m "feat(auth-header): renderizar PaymentPendingTrigger quando paid=false"
```

---

## Task 7: Verificação manual

Pré-requisitos: `NEXT_PUBLIC_QR_CODE_PAY` setado no `.env.local`; existir um usuário com `paid = false` e outro com `paid = true`.

- [ ] **Step 1: Subir dev**

Run: `npm run dev`

- [ ] **Step 2: Cenário paid=false, desktop**

1. Logar com usuário `paid = false`.
2. Verificar: modal abre automaticamente ao entrar em `/inicio`.
3. Fechar com X.
4. Recarregar `/inicio`: modal **não** reabre.
5. Clicar em "Pagar inscrição" no header: modal reabre.
6. Clicar em "Copiar": toast de sucesso, verificar clipboard.
7. Clicar em "Já paguei, avisar no WhatsApp": abre `wa.me` em nova aba com mensagem pré-preenchida.

- [ ] **Step 3: Cenário paid=false, mobile (largura < 768px)**

1. Devtools modo responsivo (375px).
2. Ver ícone cifrão com dot vermelho onde antes ficaria o botão.
3. Tap no ícone reabre o modal.
4. Modal renderiza responsivo (QR não vaza, código preview cabe).

- [ ] **Step 4: Cenário paid=true**

1. Logar (ou marcar via admin) usuário `paid = true`.
2. Nenhum botão de pagamento aparece no header.
3. Modal nunca abre.

- [ ] **Step 5: Cenário sem `NEXT_PUBLIC_QR_CODE_PAY`**

1. Comentar a var no `.env.local`, reiniciar dev.
2. Abrir modal: bloco copia-e-cola está oculto; QR e WhatsApp continuam visíveis.
3. Restaurar a var.

- [ ] **Step 6: Confirmar**

Marcar tudo OK ou reportar regressões.

---

## Notas

- **Não criar testes vitest** — o padrão do projeto reserva vitest para
  lógica pura em `src/lib/**/__tests__/`. Componentes UI são validados
  manualmente.
- **Não adicionar `priority` à `<Image>` do QR** — ele só aparece dentro do
  modal, raramente é LCP.
- **Não fazer fallback se navegador antigo não tiver `sessionStorage`** —
  Next 16 + React 19 + alvo moderno; o `try/catch` no efeito seria ruído.
