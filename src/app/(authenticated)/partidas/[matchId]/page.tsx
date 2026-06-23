import { notFound } from "next/navigation";
import { getMatchPredictions } from "./_lib/get-match-predictions";
import { MatchHeader } from "./_components/match-header";
import { PredictionsList } from "./_components/predictions-list";
import { MatchSimulator } from "./_components/match-simulator";

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

  const isValidStatus =
    match.status !== "cancelled" && match.status !== "postponed";

  const hasResult =
    match.home_score !== null && match.away_score !== null && isValidStatus;

  const canSimulate =
    match.home_score === null && match.away_score === null && isValidStatus;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <MatchHeader match={match} />
      {canSimulate ? (
        <MatchSimulator
          rows={predictions}
          stage={match.stage}
          homeName={match.home_team?.name ?? "Mandante"}
          awayName={match.away_team?.name ?? "Visitante"}
        />
      ) : (
        <PredictionsList rows={predictions} showPoints={hasResult} />
      )}
    </main>
  );
}
