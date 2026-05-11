# Modal de pagamento pendente — design

## Contexto

Usuários autenticados com `profiles.paid = false` precisam ser lembrados de pagar
a inscrição (R$ 35) via Pix e avisar o organizador pelo WhatsApp. Hoje não há
nenhuma indicação visual disso na área autenticada — só admins veem em
`/admin/usuarios`.

A coluna `paid` já existe em `profiles` e é atualizada por
`setUserPaid()` em `src/app/(authenticated)/admin/usuarios/actions.ts:7`.

## Objetivos

- Lembrar o usuário pendente do pagamento sem ser bloqueante.
- Oferecer QR Code Pix, código copia-e-cola e link de aviso pelo WhatsApp.
- Não incomodar a cada navegação: 1x por sessão automaticamente + acesso manual
  permanente via header.

## Não-objetivos

- Confirmar pagamento automaticamente (continua manual via admin).
- Integração com gateway/PSP.
- Tracking de tentativas/cliques.

## Arquitetura

Três novos componentes em `src/app/(authenticated)/_components/`:

1. **`payment-pending-trigger.tsx`** (client) — botão no header. Detém:
   - Estado `open` do modal.
   - Efeito que abre automaticamente 1x por sessão usando
     `sessionStorage.getItem("bb:payment-modal-seen")`. Marca como visto ao
     fechar a primeira aparição automática.
   - Render do botão (desktop) ou ícone (mobile).
   - Render do `<PaymentPendingModal open={…} onOpenChange={…} />`.

2. **`payment-pending-modal.tsx`** (client) — `Dialog` dismissível espelhando
   o estilo do `whatsapp-required-modal.tsx`, mas com `showCloseButton` padrão
   (true) e sem `disablePointerDismissal`.

3. **`copy-pix-button.tsx`** (client) — preview de 12 chars + botão Copiar.

Integração:

- `src/types/profile.ts` — adicionar campo `paid: boolean`.
- `src/app/(authenticated)/layout.tsx` — incluir `paid` no `.select(...)` e
  passar `paid` como prop para `AuthHeader`.
- `src/app/(authenticated)/_components/auth-header.tsx` — receber `paid` e
  renderizar `<PaymentPendingTrigger />` quando `paid === false`.

## Onde injetar o trigger no AuthHeader

Existem dois pontos plausíveis:

- **Desktop**: dentro do `<div>` flex principal (linha 32), antes do
  `DropdownMenu` do avatar (linha 82). `hidden md:inline-flex`.
- **Mobile**: dentro do mesmo `<div>` mas com `md:hidden`. Aparece à esquerda do
  avatar.

Decisão: renderizar um único `<PaymentPendingTrigger />` que internamente alterna
estilos com classes responsivas. Isso evita dois `useState` e dois `useEffect`
com `sessionStorage` competindo.

## Visual

### Trigger no header

- **Desktop (`hidden md:inline-flex`)**: `<Button variant="destructive" size="sm">`
  com texto "Pagar inscrição". Ícone `CircleDollarSign` (lucide) à esquerda.
- **Mobile (`inline-flex md:hidden`)**: botão ícone (`size="icon"`,
  `variant="destructive"`) com `CircleDollarSign` e um dot vermelho absoluto no
  canto superior direito (`after:` pseudo ou `<span>` posicionado).

### Modal

Estrutura (em ordem vertical, alinhado ao centro):

1. Ícone Bisteka em quadrado arredondado (mesmo padrão do
   `whatsapp-required-modal`).
2. `DialogTitle`: "Inscrição pendente".
3. `DialogDescription`: "Você ainda não confirmou o pagamento da sua inscrição
   no bolão. Pague via Pix e nos avise pelo WhatsApp."
4. Bloco de valor: `<p class="text-3xl font-heading">R$ 35</p>` usando
   `formatBRL(INSCRIPTION_VALUE_BRL)` de `src/lib/bolao-config.ts`.
5. QR Code: `<Image src="/qrcodepix.png" alt="QR Code Pix" width={220}
   height={220} class="rounded-md ring-1 ring-border" />`.
6. Bloco copia-e-cola: ver componente `CopyPixButton` abaixo.
7. `<Button asChild size="lg" class="h-12">` envolvendo `<a>` para
   `https://wa.me/554799680801?text=Olá!%20Acabei%20de%20pagar%20a%20inscrição%20do%20Bisteka%20Bet.`
   com `target="_blank" rel="noopener noreferrer"`. Texto:
   "Já paguei, avisar no WhatsApp". Ícone WhatsApp (lucide `MessageCircle` ou
   `phone`) à esquerda.

X no canto e fechamento por ESC/click-outside funcionam por padrão do `Dialog`.

### `CopyPixButton`

```
<div class="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
  <code class="text-xs font-mono text-muted-foreground truncate">
    {code.slice(0, 12)}…
  </code>
  <Button variant="outline" size="sm" onClick={handleCopy}>
    <Copy class="size-4" /> Copiar
  </Button>
</div>
```

Comportamento:

- Ao clicar: `navigator.clipboard.writeText(code)` + `toast.success("Código Pix copiado")`
  via `sonner`.
- Se a Clipboard API falhar (HTTP, permissões), `toast.error("Não foi possível
  copiar. Selecione e copie manualmente.")`.

## Variável de ambiente

- `.env.local`: renomear `QR_CODE_PAY` → `NEXT_PUBLIC_QR_CODE_PAY`.
- `.env.local.example`: adicionar entrada equivalente sem valor real.
- Acesso no componente: `process.env.NEXT_PUBLIC_QR_CODE_PAY ?? ""`. Se vazio,
  esconder o bloco copia-e-cola (defensivo, não esperado em produção).

## Comportamento de abertura automática

Estado lógico no `PaymentPendingTrigger`:

```tsx
const [open, setOpen] = useState(false);

useEffect(() => {
  if (sessionStorage.getItem("bb:payment-modal-seen") === "1") return;
  setOpen(true);
  sessionStorage.setItem("bb:payment-modal-seen", "1");
}, []);
```

Marcar no momento da abertura automática (não no fechamento) evita reaparecer se
o usuário recarregar durante o modal aberto. Botão do header continua abrindo
manualmente quantas vezes quiser via `setOpen(true)`.

## Acessibilidade

- `Dialog` da shadcn já provê `role="dialog"`, `aria-modal`, foco automático e
  trap.
- Ícone do botão mobile precisa de `aria-label="Pagamento pendente"`.
- QR code: `alt="QR Code Pix"`.
- Botão WhatsApp é `<a>` com texto visível — descrição implícita ok.

## Edge cases

- **Profile `paid = true`**: trigger não é renderizado, modal nunca aparece.
- **Pago durante a sessão**: o `paid` é lido no server layout. Próxima navegação
  full reload reflete; navegação client-side pode manter trigger até refresh.
  Aceito — admin marca pago manualmente e é raro coincidir com sessão ativa.
- **`NEXT_PUBLIC_QR_CODE_PAY` ausente**: esconder bloco copia-e-cola, mas manter
  QR code + botão WhatsApp.
- **`navigator.clipboard` indisponível**: toast de erro com instrução manual.

## Arquivos afetados

Novos:
- `src/app/(authenticated)/_components/payment-pending-modal.tsx`
- `src/app/(authenticated)/_components/payment-pending-trigger.tsx`
- `src/app/(authenticated)/_components/copy-pix-button.tsx`

Modificados:
- `src/types/profile.ts` — adicionar `paid: boolean`.
- `src/app/(authenticated)/layout.tsx` — incluir `paid` no select e passar para
  `AuthHeader`.
- `src/app/(authenticated)/_components/auth-header.tsx` — prop `paid` e render
  condicional do trigger.
- `.env.local` e `.env.local.example` — renomear var.

## Testes manuais

1. Login com usuário `paid = false`:
   - Modal abre automaticamente na primeira navegação para área autenticada.
   - X, ESC e click-outside fecham.
   - Refresh na mesma sessão: modal **não** reabre automaticamente.
   - Botão "Pagar inscrição" no header reabre manualmente.
   - Botão Copiar coloca o código completo no clipboard.
   - Botão WhatsApp abre `wa.me` em nova aba.
2. Login com usuário `paid = true`: nenhum botão e nenhum modal.
3. Mobile (largura < 768px): vê ícone cifrão com dot vermelho; modal renderiza
   responsivo.
