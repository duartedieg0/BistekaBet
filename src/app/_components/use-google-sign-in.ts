"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useGoogleSignIn() {
  const [supabase] = useState(() => createClient());
  const [pending, setPending] = useState(false);

  async function signIn() {
    if (pending) return;
    setPending(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/inicio`,
      },
    });
    if (error) {
      console.error("OAuth init failed", error);
      setPending(false);
    }
  }

  return { signIn, pending };
}
