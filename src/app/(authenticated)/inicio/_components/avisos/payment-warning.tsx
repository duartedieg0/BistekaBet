"use client";

import { AlertCircle } from "lucide-react";
import { OPEN_PAYMENT_MODAL_EVENT } from "../../../_components/payment-pending-trigger";

export function PaymentWarning() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Pagamento pendente</span>
        <span className="text-muted-foreground">
          Sua inscrição precisa ser confirmada.{" "}
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new Event(OPEN_PAYMENT_MODAL_EVENT))
            }
            className="underline underline-offset-2 hover:text-foreground"
          >
            Como pagar?
          </button>
        </span>
      </div>
    </div>
  );
}
