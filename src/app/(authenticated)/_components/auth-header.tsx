// src/app/(authenticated)/_components/auth-header.tsx
"use client";

import { useRef } from "react";
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

export function AuthHeader({ profile }: { profile: Profile }) {
  const signoutFormRef = useRef<HTMLFormElement>(null);

  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <Link href="/inicio" className="font-semibold tracking-tight">
        BistekaBet
      </Link>

      {/* form fora do menu para evitar DOM inválido (form dentro de role=menu) */}
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
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Admin
                </span>
              )}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              signoutFormRef.current?.requestSubmit();
            }}
            className="flex items-center gap-2"
          >
            <LogOut className="size-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
