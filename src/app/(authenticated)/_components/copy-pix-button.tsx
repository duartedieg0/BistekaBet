"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyPixButton({ code }: { code: string }) {
  const preview = code.slice(0, 12);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código Pix copiado");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
      <code className="flex-1 truncate font-mono text-xs text-muted-foreground">
        {preview}…
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="shrink-0"
      >
        <Copy className="size-4" />
        Copiar
      </Button>
    </div>
  );
}
