import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function RaioXEmpty() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <TrendingUp className="size-8 text-muted-foreground" aria-hidden />
        <p className="max-w-sm text-sm text-muted-foreground">
          Você ainda não pontuou. Seu raio-x aparece assim que você somar os
          primeiros pontos.
        </p>
      </CardContent>
    </Card>
  );
}
