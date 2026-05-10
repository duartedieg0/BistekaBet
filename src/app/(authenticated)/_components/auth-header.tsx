"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile } from "@/types/profile";
import { getInitials } from "./avatar-fallback";

const NAV = [
  { href: "/inicio", label: "Início" },
  { href: "/palpites", label: "Palpites" },
  { href: "/classificacao", label: "Ranking" },
  { href: "/regulamento", label: "Regulamento" },
];

export function AuthHeader({ profile }: { profile: Profile }) {
  const signoutFormRef = useRef<HTMLFormElement>(null);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6">
        <Link
          href="/inicio"
          className="inline-flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <span className="flex size-9 items-center justify-center overflow-hidden rounded-md bg-secondary ring-1 ring-border">
            <Image
              src="/BISTECA.png"
              alt=""
              width={36}
              height={36}
              priority
              className="size-9 object-contain"
            />
          </span>
          <span className="font-heading text-2xl uppercase tracking-wide">
            Bisteka<span className="text-primary">Bet</span>
          </span>
        </Link>

        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-1 md:flex"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          {profile.role === "admin" && (
            <Link
              href="/admin"
              className="ml-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm font-semibold uppercase tracking-wider text-destructive transition-colors hover:bg-destructive/15"
            >
              Admin
            </Link>
          )}
        </nav>

        <form
          ref={signoutFormRef}
          action="/auth/signout"
          method="post"
          className="hidden"
        />

        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="size-9">
              <AvatarImage
                src={profile.avatar_url ?? undefined}
                alt={profile.display_name}
              />
              <AvatarFallback>{getInitials(profile.display_name)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-1">
                <span className="font-medium">{profile.display_name}</span>
                {profile.role === "admin" && (
                  <span className="text-xs font-semibold uppercase tracking-wider text-destructive">
                    Admin
                  </span>
                )}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signoutFormRef.current?.requestSubmit()}
              className="flex items-center gap-2"
            >
              <LogOut className="size-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav
        aria-label="Navegação principal"
        className="border-t border-border md:hidden"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex h-10 shrink-0 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted"
            >
              {item.label}
            </Link>
          ))}
          {profile.role === "admin" && (
            <Link
              href="/admin"
              className="ml-1 inline-flex h-10 shrink-0 items-center rounded-md border border-destructive/30 bg-destructive/10 px-3 text-sm font-semibold uppercase tracking-wider text-destructive transition-colors hover:bg-destructive/15"
            >
              Admin
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
