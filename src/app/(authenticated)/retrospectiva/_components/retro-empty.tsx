import { Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function RetroEmpty() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <Heart className="size-8 text-primary" aria-hidden />
        <p className="max-w-sm text-muted-foreground">
          Sua Copa foi de torcida, não de números — e isso é o que importa.
          Obrigado por estar no bolão com a gente. 🇧🇷
        </p>
      </CardContent>
    </Card>
  );
}
