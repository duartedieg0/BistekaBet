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
