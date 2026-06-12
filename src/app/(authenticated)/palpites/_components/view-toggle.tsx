"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type View = "date" | "table";

export function ViewToggle({
  active,
  defaultDate,
}: {
  active: View;
  defaultDate: string;
}) {
  const router = useRouter();

  const goDate = () => router.push(`/palpites?view=date&date=${defaultDate}`);
  const goTable = () => router.push(`/palpites?stage=group&group=A`);

  const titleBase =
    "font-heading text-4xl uppercase tracking-tight sm:text-5xl text-left transition-opacity";
  const activeCls = "text-foreground";
  const inactiveCls = "opacity-40 text-muted-foreground hover:opacity-60 cursor-pointer";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <button
        type="button"
        onClick={goDate}
        aria-pressed={active === "date"}
        className={cn(titleBase, active === "date" ? activeCls : inactiveCls)}
      >
        Jogos por data
      </button>
      <span
        aria-hidden
        className="font-heading text-4xl sm:text-5xl text-muted-foreground/40 select-none"
      >
        ·
      </span>
      <button
        type="button"
        onClick={goTable}
        aria-pressed={active === "table"}
        className={cn(titleBase, active === "table" ? activeCls : inactiveCls)}
      >
        Tabela de jogos
      </button>
    </div>
  );
}
