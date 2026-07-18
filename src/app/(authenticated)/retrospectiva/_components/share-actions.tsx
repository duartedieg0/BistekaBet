"use client";

import { useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const TARGET_W = 1080;

export function ShareActions({
  cardId,
  fileName,
}: {
  cardId: string;
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);

  async function render(): Promise<Blob | null> {
    const node = document.getElementById(cardId);
    if (!node) return null;
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    const pixelRatio = TARGET_W / node.offsetWidth; // reaches 1080 wide → 1920 tall
    const dataUrl = await toPng(node, { pixelRatio, cacheBust: true });
    const res = await fetch(dataUrl);
    return await res.blob();
  }

  async function onDownload() {
    setBusy(true);
    try {
      const blob = await render();
      if (!blob) throw new Error("card não encontrado");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Não consegui gerar a imagem. Tente um print da tela.");
    } finally {
      setBusy(false);
    }
  }

  async function onShare() {
    setBusy(true);
    try {
      const blob = await render();
      if (!blob) throw new Error("card não encontrado");
      const file = new File([blob], fileName, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (d: ShareData) => boolean;
      };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Minha Retrospectiva BistekaBet",
        });
      } else {
        await onDownload();
      }
    } catch {
      /* usuário cancelou ou sem suporte: silencioso */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={onShare} disabled={busy}>
        {busy ? "Gerando…" : "Compartilhar"}
      </Button>
      <Button variant="outline" onClick={onDownload} disabled={busy}>
        Baixar imagem
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        Dica: o Instagram não recebe direto da web — baixe/compartilhe e suba nos
        seus Stories.
      </p>
    </div>
  );
}
