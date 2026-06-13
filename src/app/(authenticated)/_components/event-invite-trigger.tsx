"use client";

import { useEffect, useState } from "react";
import { EventInviteModal } from "./event-invite-modal";

const STORAGE_KEY = "bb:event-invite-dismissed-v1";

export function EventInviteTrigger() {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-open após mount no cliente; localStorage não disponível em SSR
    setOpen(true);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && dontShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore quota/availability errors
      }
    }
  }

  return (
    <EventInviteModal
      open={open}
      onOpenChange={handleOpenChange}
      dontShowAgain={dontShowAgain}
      onDontShowAgainChange={setDontShowAgain}
    />
  );
}
