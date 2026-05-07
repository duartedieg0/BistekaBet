// src/app/(authenticated)/admin/layout.tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/profile";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // user já garantido pelo (authenticated)/layout pai; defensivo apenas
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: Role }>();

  if (profile?.role !== "admin") notFound();

  return <>{children}</>;
}
