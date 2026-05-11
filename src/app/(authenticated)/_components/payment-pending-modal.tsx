"use client";

import Image from "next/image";
import { MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      <DialogContent className="max-w-[calc(100%-2rem)] gap-5 p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:max-w-md">
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

        <a
          href={WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-12 text-base font-semibold",
          )}
        >
          <MessageCircle className="size-5" />
          Já paguei, avisar no WhatsApp
        </a>
      </DialogContent>
    </Dialog>
  );
}
