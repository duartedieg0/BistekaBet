import Link from "next/link";
import { cn } from "@/lib/utils";

export function PremiacaoNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Top 3 levam uma camisa da Seleção Brasileira.{" "}
      <Link
        href="/regulamento#premiacao"
        className="underline hover:text-foreground"
      >
        Ver premiação no regulamento
      </Link>
      .
    </p>
  );
}
