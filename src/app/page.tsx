import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Hero } from "./_components/landing/hero";
import { HowItWorks } from "./_components/landing/how-it-works";
import { SocialProof } from "./_components/landing/social-proof";
import { Faq } from "./_components/landing/faq";
import { FinalCta } from "./_components/landing/final-cta";
import { LandingFooter } from "./_components/landing-footer";
import { LandingNav } from "./_components/landing-nav";

const ERROR_MESSAGES: Record<string, string> = {
  auth: "Não foi possível concluir o login. Tente novamente.",
  profile:
    "Sua conta foi criada, mas o perfil não pôde ser carregado. Tente entrar novamente.",
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
    <>
      <LandingNav />
      <main className="flex flex-col">
        <Hero errorMessage={errorMessage} />
        <HowItWorks />
        <section id="prova">
          <SocialProof />
        </section>
        <section id="faq">
          <Faq />
        </section>
        <section id="cta">
          <FinalCta />
        </section>
      </main>
      <LandingFooter />
    </>
  );
}
