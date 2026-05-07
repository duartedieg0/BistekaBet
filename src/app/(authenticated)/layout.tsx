// src/app/(authenticated)/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profile";
import { AuthHeader } from "./_components/auth-header";

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
    .select("id, role, display_name, avatar_url, created_at, updated_at")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/?error=profile");

  return (
    <div className="flex min-h-screen flex-col">
      <AuthHeader profile={profile} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
