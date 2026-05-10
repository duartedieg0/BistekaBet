import { Toaster } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profile";
import { AuthHeader } from "../(authenticated)/_components/auth-header";
import { LandingFooter } from "../_components/landing-footer";
import { LandingNav } from "../_components/landing-nav";
import { RegulamentoContent } from "../_components/regulamento-content";

export const metadata = { title: "Regulamento — BistekaBet" };

export default async function RegulamentoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? (
        await supabase
          .from("profiles")
          .select("id, role, display_name, avatar_url, created_at, updated_at")
          .eq("id", user.id)
          .single<Profile>()
      ).data
    : null;

  if (profile) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AuthHeader profile={profile} />
        <div className="flex-1">
          <RegulamentoContent />
        </div>
        <Toaster richColors position="top-right" />
      </div>
    );
  }

  return (
    <>
      <LandingNav />
      <RegulamentoContent />
      <LandingFooter />
    </>
  );
}
