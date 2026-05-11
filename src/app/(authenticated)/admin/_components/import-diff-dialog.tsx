"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DiffEntry } from "@/lib/api-football/types";

type Props = {
  open: boolean;
  entries: DiffEntry[];
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function fmt(v: unknown): string {
  if (v === null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return JSON.stringify(v);
}

export function ImportDiffDialog({ open, entries, pending, onClose, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Confirmar import</DialogTitle>
          <DialogDescription>
            {entries.length === 0
              ? "Nada a importar."
              : `${entries.length} partida(s) serão atualizadas.`}
          </DialogDescription>
        </DialogHeader>

        {entries.length > 0 && (
          <div className="space-y-3 text-sm">
            {entries.map((e) => (
              <div key={e.matchId} className="rounded border p-2">
                <div className="font-medium">{e.label}</div>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {e.changes.map((c, i) => (
                    <li key={i}>
                      <code>{c.field}</code>: {fmt(c.from)} → <strong>{fmt(c.to)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
          {entries.length > 0 && (
            <Button onClick={onConfirm} disabled={pending}>
              {pending ? "Aplicando..." : "Confirmar"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
