"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatWhatsappMask } from "@/lib/whatsapp/format";

interface Props {
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  describedById?: string;
  disabled?: boolean;
}

export function WhatsappInput({
  value,
  onChange,
  invalid,
  describedById,
  disabled,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="whatsapp">WhatsApp</Label>
      <Input
        id="whatsapp"
        name="whatsapp"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        autoFocus
        placeholder="(11) 91234-5678"
        value={value}
        onChange={(e) => onChange(formatWhatsappMask(e.target.value))}
        aria-invalid={invalid || undefined}
        aria-describedby={describedById}
        disabled={disabled}
        className={cn("h-12 text-base", invalid && "border-destructive")}
      />
    </div>
  );
}
