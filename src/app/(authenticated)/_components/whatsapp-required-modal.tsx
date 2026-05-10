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

  const errorMessage = state && !state.ok ? ERROR_COPY[state.error] : null;

  const digits = value.replace(/\D/g, "");
  const canSubmit = digits.length === 11 && !pending;

  return (
    <Dialog open disablePointerDismissal>
      <DialogContent
        showCloseButton={false}
        className="max-w-md gap-5 p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]"
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
