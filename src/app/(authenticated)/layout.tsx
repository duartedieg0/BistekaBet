// src/app/(authenticated)/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profile";
import { Toaster } from "@/components/ui/sonner";
import { AuthHeader } from "./_components/auth-header";
import { WhatsappRequiredModal } from "./_components/whatsapp-required-modal";
import { getAppSetting } from "@/lib/app-settings";
import { EventInviteTrigger } from "./_components/event-invite-trigger";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, display_name, avatar_url, whatsapp, notify_whatsapp, paid, created_at, updated_at")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/?error=profile");

  const eventInviteEnabled = profile.paid
    ? await getAppSetting<boolean>("event_invite_enabled", false)
    : false;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AuthHeader profile={profile} />
      <div className="flex-1">{children}</div>
      <Toaster richColors position="top-right" />
      {profile.whatsapp === null && <WhatsappRequiredModal />}
      {eventInviteEnabled && <EventInviteTrigger />}
    </div>
  );
}
