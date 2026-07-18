import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ZebraCandidate } from "@/lib/scoring/retro-core";

export function RetroZebra({ zebra }: { zebra: ZebraCandidate | null }) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-3xl uppercase tracking-tight sm:text-4xl">
          Sua zebra
        </h2>
        <p className="text-muted-foreground">
          O jogo improvável que você apostou.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <Sparkles className="size-8 text-primary" aria-hidden />
          {zebra ? (
            <>
              <p className="text-lg font-semibold">
                Você cravou{" "}
                <span className="text-primary">
                  {zebra.homeName} × {zebra.awayName}
                </span>
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Dois azarões, um palpite certeiro — isso é acreditar no futebol
                quando ninguém mais acredita.
              </p>
            </>
          ) : (
            <p className="max-w-sm text-muted-foreground">
              Você torceu por jogos que nunca imaginou — e isso não tem preço.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
