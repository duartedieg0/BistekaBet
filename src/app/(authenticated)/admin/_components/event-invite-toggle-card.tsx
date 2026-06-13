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
      toast.success(next ? "Convite ativado." : "Convite desativado.");
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
            onCheckedChange={(checked) => handleChange(checked)}
          />
        </label>
      </CardContent>
    </Card>
  );
}
