import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadRetrospectiva } from "@/lib/scoring/retro";
import { RetroHero } from "./_components/retro-hero";
import { RetroCollective } from "./_components/retro-collective";
import { RetroJourney } from "./_components/retro-journey";
import { RetroZebra } from "./_components/retro-zebra";
import { RetroPersonaReveal } from "./_components/retro-persona-reveal";
import { RetroClosing } from "./_components/retro-closing";
import { RetroEmpty } from "./_components/retro-empty";
import { ShareCard } from "./_components/share-card";
import { ShareActions } from "./_components/share-actions";

export default async function RetrospectivaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const retro = await loadRetrospectiva(user.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-16 px-6 py-12">
      <RetroHero user={retro.user} />
      <RetroCollective collective={retro.collective} />
      {retro.hasData ? (
        <>
          <RetroJourney journey={retro.journey} timeline={retro.timeline} />
          <RetroZebra zebra={retro.zebra} />
          <RetroPersonaReveal persona={retro.persona} />
        </>
      ) : (
        <RetroEmpty />
      )}
      <RetroClosing persona={retro.persona} />
      <section id="retro-card" className="flex flex-col items-center gap-6 scroll-mt-8">
        <ShareCard
          persona={retro.persona}
          journey={retro.journey}
          zebra={retro.zebra}
          user={retro.user}
        />
        <ShareActions cardId="retro-share-card" fileName="minha-copa-bistekabet.png" />
      </section>
    </main>
  );
}
