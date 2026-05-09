"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { recomputeAllScores } from "../_actions";

export function RecomputeScoresCard() {
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <h2 className="font-heading text-2xl tracking-wide">Pontuação</h2>
        <p className="text-sm text-muted-foreground">
          Recalcula os pontos de todos os palpites com base nos resultados oficiais
          registrados. Use após corrigir resultados ou alterar regras.
        </p>
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const r = await recomputeAllScores();
                toast.success(
                  `${r.matchesProcessed} partidas processadas — ${r.upserted} atualizados, ${r.deleted} removidos.`,
                );
              } catch {
                toast.error("Não foi possível recalcular as pontuações.");
              }
            })
          }
        >
          {pending ? "Recalculando..." : "Recalcular pontuações"}
        </Button>
      </CardContent>
    </Card>
  );
}
