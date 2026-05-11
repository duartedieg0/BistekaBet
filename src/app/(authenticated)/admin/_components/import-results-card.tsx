"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { previewImport, commitImport } from "@/app/(authenticated)/admin/_actions";
import type { DiffEntry } from "@/lib/api-football/types";
import { ImportDiffDialog } from "./import-diff-dialog";

export function ImportResultsCard() {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<DiffEntry[]>([]);

  const onClickPreview = () =>
    startTransition(async () => {
      const r = await previewImport();
      if (!r.ok) { toast.error(`Falha no preview: ${r.error}`); return; }
      setEntries(r.entries);
      setOpen(true);
      if (r.entries.length === 0) toast.info("Nada a importar.");
    });

  const onConfirm = () =>
    startTransition(async () => {
      const r = await commitImport(entries);
      if (!r.ok) { toast.error(`Falha no commit: ${r.error}`); return; }
      toast.success(`${r.updated} atualizadas, ${r.errored} com erro.`);
      setOpen(false);
      setEntries([]);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar resultados (API-Football)</CardTitle>
        <CardDescription>
          Busca placares finalizados, mostra diff e aplica após confirmação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button disabled={pending} onClick={onClickPreview}>
          {pending ? "Carregando..." : "Importar resultados agora"}
        </Button>
      </CardContent>
      <ImportDiffDialog
        open={open}
        entries={entries}
        pending={pending}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
      />
    </Card>
  );
}
