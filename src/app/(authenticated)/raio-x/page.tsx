import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadRaioX } from "@/lib/scoring/raio-x";
import { HighlightCards } from "./_components/highlight-cards";
import { RankTimelineChart } from "./_components/rank-timeline-chart";
import { DailyTable } from "./_components/daily-table";
import { RaioXEmpty } from "./_components/raio-x-empty";

export default async function RaioXPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const data = await loadRaioX(user.id);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Bolão Copa 2026
        </p>
        <h1 className="font-heading text-4xl uppercase tracking-tight sm:text-5xl">
          Raio-X
        </h1>
        <p className="text-muted-foreground">
          Sua trajetória de posição e pontos ao longo da Copa.
        </p>
        <Link
          href="/retrospectiva"
          className="mt-1 inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Veja sua Retrospectiva completa →
        </Link>
      </header>

      {data.hasData ? (
        <>
          <HighlightCards highlights={data.highlights} />
          <RankTimelineChart timeline={data.timeline} />
          <DailyTable timeline={data.timeline} />
        </>
      ) : (
        <RaioXEmpty />
      )}
    </main>
  );
}
