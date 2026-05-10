import Link from "next/link";
import { ListTodo } from "lucide-react";

export function PendingPredictions({ count }: { count: number }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border/60 p-3">
      <ListTodo className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">
          {count} palpite{count === 1 ? "" : "s"} pendente{count === 1 ? "" : "s"}
        </span>
        <Link href="/palpites" className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Palpitar agora
        </Link>
      </div>
    </div>
  );
}
