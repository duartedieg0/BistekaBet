"use client";

import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { saveNotifyWhatsapp } from "@/app/(authenticated)/_actions/save-notify-whatsapp";

type Props = {
  initialEnabled: boolean;
};

export function WhatsappReminderToggle({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [, startTransition] = useTransition();

  function handleChange(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    startTransition(async () => {
      const result = await saveNotifyWhatsapp(next);
      if (!result.ok) {
        setEnabled(previous);
        toast.error("Não foi possível salvar");
      }
    });
  }

  return (
    <label
      htmlFor="whatsapp-reminder-toggle"
      className="flex cursor-pointer items-center justify-between gap-3 text-sm"
    >
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <MessageCircle className="size-4" aria-hidden />
        Lembrete por WhatsApp
      </span>
      <Switch
        id="whatsapp-reminder-toggle"
        checked={enabled}
        onCheckedChange={handleChange}
        aria-label="Lembrete por WhatsApp"
      />
    </label>
  );
}
