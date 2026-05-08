"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Visão geral", icon: ShieldCheck },
  { href: "/admin/partidas", label: "Partidas", icon: CalendarDays },
  { href: "/admin/times", label: "Times", icon: Trophy },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/pagamentos", label: "Pagamentos", icon: Wallet },
  { href: "/admin/config", label: "Configurações", icon: Settings },
];

interface Props {
  children: React.ReactNode;
}

function deriveActive(pathname: string): string {
  const match = ITEMS.slice(1).find((i) => pathname.startsWith(i.href));
  return match ? match.href : "/admin";
}

function deriveBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  if (pathname === "/admin") return [];
  const item = ITEMS.slice(1).find((i) => pathname.startsWith(i.href));
  if (!item) return [];
  const isDeep = pathname !== item.href;
  return isDeep
    ? [{ label: item.label, href: item.href }, { label: "Detalhes" }]
    : [{ label: item.label }];
}

export function AdminShell({ children }: Props) {
  const pathname = usePathname();
  const active = deriveActive(pathname);
  const breadcrumbs = deriveBreadcrumbs(pathname);
  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <div className="flex size-8 items-center justify-center rounded-md bg-destructive/15 text-destructive">
            <ShieldCheck className="size-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-heading text-lg uppercase tracking-wide">Painel</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-destructive">
              Modo Admin
            </span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
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
                    ? "bg-destructive/10 text-destructive"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <Link
            href="/inicio"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Voltar ao app
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 items-center gap-2 border-b border-border bg-destructive/5 px-6 text-xs">
          <ShieldCheck className="size-3.5 text-destructive" />
          <span className="font-semibold uppercase tracking-widest text-destructive">
            Admin
          </span>
          {breadcrumbs?.length ? (
            <>
              <ChevronRight className="size-3 text-muted-foreground" />
              <ol className="flex items-center gap-1 text-muted-foreground">
                {breadcrumbs.map((b, i) => (
                  <li key={i} className="inline-flex items-center gap-1">
                    {b.href ? (
                      <Link
                        href={b.href}
                        className="transition-colors hover:text-foreground"
                      >
                        {b.label}
                      </Link>
                    ) : (
                      <span className="text-foreground">{b.label}</span>
                    )}
                    {i < breadcrumbs.length - 1 ? (
                      <ChevronRight className="size-3" />
                    ) : null}
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </div>

        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
