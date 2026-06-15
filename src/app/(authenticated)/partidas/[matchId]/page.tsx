import { notFound } from "next/navigation";
import { getMatchPredictions } from "./_lib/get-match-predictions";
import { MatchHeader } from "./_components/match-header";
import { PredictionsList } from "./_components/predictions-list";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const data = await getMatchPredictions(matchId);
  if (!data) notFound();

  const { match, predictions } = data;

  if (new Date(match.kickoff_at).getTime() > Date.now()) {
    notFound();
  }

  const hasResult =
    match.home_score !== null &&
    match.away_score !== null &&
    match.status !== "cancelled" &&
    match.status !== "postponed";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <MatchHeader match={match} />
      <PredictionsList rows={predictions} showPoints={hasResult} />
    </main>
  );
}
