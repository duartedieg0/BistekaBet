"use client";

import Image from "next/image";
import { Beer, MapPin, UtensilsCrossed, XIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EventInviteModal({
  open,
  onOpenChange,
  dontShowAgain,
  onDontShowAgainChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dontShowAgain: boolean;
  onDontShowAgainChange: (value: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-2rem)] gap-5 p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:max-w-md"
      >
        <DialogClose
          render={
            <button
              type="button"
              aria-label="Fechar"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "absolute top-2 right-2",
              )}
            />
          }
        >
          <XIcon />
        </DialogClose>

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center gap-3">
            <Image
              src="/BISTECA.png"
              alt="Bisteka Bet"
              width={48}
              height={48}
              className="size-12 object-contain"
            />
            <Image
              src="/logo_coringas.png"
              alt="Equipe Coringas"
              width={48}
              height={48}
              className="size-12 object-contain"
            />
          </div>
          <DialogTitle className="text-center font-heading text-xl uppercase tracking-wide">
            Bisteka Bet + Equipe Coringas: Rumo ao hexa! 🏆💛
          </DialogTitle>
          <DialogDescription className="text-center leading-relaxed">
            Venha assistir a estreia da Seleção com a gente.
          </DialogDescription>
        </div>

        <ul className="flex flex-col gap-3 text-sm">
          <li className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              <span className="font-semibold">Local:</span> Xepa do Ipiranga
            </span>
          </li>
          <li className="flex items-start gap-3">
            <UtensilsCrossed className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>Espetinho com precinho especial</span>
          </li>
          <li className="flex items-start gap-3">
            <Beer className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>Bebidas consumidas do local</span>
          </li>
        </ul>

        <label
          htmlFor="event-invite-dont-show-again"
          className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
        >
          <Checkbox
            id="event-invite-dont-show-again"
            checked={dontShowAgain}
            onCheckedChange={(checked) => onDontShowAgainChange(checked)}
          />
          Não exibir novamente
        </label>
      </DialogContent>
    </Dialog>
  );
}
