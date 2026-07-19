"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { setCopaEncerrada } from "../_actions";

export function CopaEncerradaToggleCard({
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
      const result = await setCopaEncerrada(next);
      if (!result.ok) {
        setEnabled(previous);
        toast.error("Não foi possível atualizar o encerramento.");
        return;
      }
      toast.success(
        next
          ? "Landing de encerramento ativada."
          : "Landing de encerramento desativada.",
      );
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <h2 className="font-heading text-2xl tracking-wide">
          Encerramento da Copa
        </h2>
        <p className="text-sm text-muted-foreground">
          Quando ligado, a home pública (visitantes deslogados) passa a exibir a
          landing de retrospectiva: campeão, pódio, números da Copa e a
          classificação final.
        </p>
        <label
          htmlFor="copa-encerrada"
          className="flex cursor-pointer items-center justify-between gap-3 text-sm"
        >
          <span>Exibir landing de retrospectiva</span>
          <Switch
            id="copa-encerrada"
            checked={enabled}
            disabled={pending}
            onCheckedChange={(checked) => handleChange(checked)}
          />
        </label>
      </CardContent>
    </Card>
  );
}
