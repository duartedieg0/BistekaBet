import { redirect } from "next/navigation";
import { GoogleSignInButton } from "./_components/google-sign-in-button";
import { createClient } from "@/lib/supabase/server";

const ERROR_MESSAGES: Record<string, string> = {
  auth: "Não foi possível concluir o login. Tente novamente.",
  profile: "Sua conta foi criada, mas o perfil não pôde ser carregado. Tente entrar novamente.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/inicio");

  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
          BistekaBet
        </p>
        <h1 className="max-w-xl text-4xl font-bold tracking-tight md:text-6xl">
          Bolão da Copa 2026
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Palpite, dispute e suba no ranking.
        </p>
      </div>

      <GoogleSignInButton />

      {errorMessage && (
        <p className="max-w-sm text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}
    </main>
  );
}
