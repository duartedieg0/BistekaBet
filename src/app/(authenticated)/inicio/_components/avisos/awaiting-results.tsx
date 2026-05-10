import { Hourglass } from "lucide-react";

export function AwaitingResults({ count }: { count: number }) {
  return (
    <div className="flex items-start gap-3 text-sm text-muted-foreground">
      <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        {count} jogo{count === 1 ? "" : "s"} aguardando resultado oficial
      </span>
    </div>
  );
}
