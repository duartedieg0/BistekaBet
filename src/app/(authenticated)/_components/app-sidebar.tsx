import Link from "next/link";
import { CalendarDays, Home, ScrollText, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/inicio#bets", label: "Minhas apostas", icon: CalendarDays },
  { href: "/inicio#ranking", label: "Ranking", icon: Trophy },
  { href: "/inicio#regras", label: "Regras", icon: ScrollText },
];

interface Props {
  active?: string;
  className?: string;
}

export function AppSidebar({ active, className }: Props) {
  return (
    <aside
      className={cn(
        "hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar lg:flex",
        className
      )}
      aria-label="Navegação secundária"
    >
      <nav className="flex flex-col gap-0.5 p-3">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = active === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
