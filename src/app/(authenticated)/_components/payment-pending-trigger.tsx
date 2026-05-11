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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot auto-open após mount no cliente; sessionStorage não disponível em SSR
    setOpen(true);
  }, []);

  return (
    <>
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
