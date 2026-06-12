"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Bucket = { date: string; count: number };

const WEEKDAY_FMT = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  timeZone: "America/Sao_Paulo",
});

function formatLabels(date: string): { weekday: string; dayMonth: string } {
  // date é YYYY-MM-DD; usamos meio-dia UTC para evitar drift em SP (UTC-3).
  const d = new Date(`${date}T12:00:00Z`);
  const weekday = WEEKDAY_FMT.format(d).replace(".", "");
  const [, mm, dd] = date.split("-");
  return { weekday, dayMonth: `${dd}/${mm}` };
}

export function DateNav({
  buckets,
  active,
}: {
  buckets: Bucket[];
  active: string;
}) {
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "instant" as ScrollBehavior,
    });
  }, [active]);

  if (buckets.length === 0) return null;

  return (
    <div className="-mx-1 mb-6 overflow-x-auto px-1 pb-1">
      <div className="flex gap-2">
        {buckets.map((b) => {
          const isActive = b.date === active;
          const { weekday, dayMonth } = formatLabels(b.date);
          return (
            <Link
              key={b.date}
              ref={isActive ? activeRef : undefined}
              href={`/palpites?view=date&date=${b.date}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-28 shrink-0 flex-col items-center rounded-lg border px-3 py-2 text-center transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              <span className="text-xs font-medium uppercase">
                {weekday} <span className="font-mono">{dayMonth}</span>
              </span>
              <span
                className={cn(
                  "mt-1 text-xs",
                  isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {b.count} {b.count === 1 ? "jogo" : "jogos"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
