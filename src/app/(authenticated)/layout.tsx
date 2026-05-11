// src/app/(authenticated)/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profile";
import { Toaster } from "@/components/ui/sonner";
import { AuthHeader } from "./_components/auth-header";
import { WhatsappRequiredModal } from "./_components/whatsapp-required-modal";

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
    .select("id, role, display_name, avatar_url, whatsapp, paid, created_at, updated_at")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/?error=profile");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AuthHeader profile={profile} />
      <div className="flex-1">{children}</div>
      <Toaster richColors position="top-right" />
      {profile.whatsapp === null && <WhatsappRequiredModal />}
    </div>
  );
}
