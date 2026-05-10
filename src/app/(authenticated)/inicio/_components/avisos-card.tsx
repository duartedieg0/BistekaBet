import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { loadAvisosData } from "../_lib/avisos-queries";
import { PaymentWarning } from "./avisos/payment-warning";
import { NextMatchCountdown } from "./avisos/next-match-countdown";
import { PendingPredictions } from "./avisos/pending-predictions";
import { AwaitingResults } from "./avisos/awaiting-results";
import { PointsProgress } from "./avisos/points-progress";
import { TudoEmDia } from "./avisos/tudo-em-dia";

export async function AvisosCard() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const data = await loadAvisosData(supabase, userData.user.id);

  const hasAttention =
    !data.paid ||
    data.nextUnpredictedMatch !== null ||
    data.pendingPredictionsCount > 0;

  const hasInfo = data.awaitingResultsCount > 0 || data.pointsPossible > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 font-heading text-xl tracking-wide">
          <Bell className="size-5 text-primary" />
          Avisos
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Atenção
          </h3>
          {hasAttention ? (
            <div className="flex flex-col gap-2">
              {!data.paid && <PaymentWarning />}
              {data.nextUnpredictedMatch && (
                <NextMatchCountdown match={data.nextUnpredictedMatch} />
              )}
              {data.pendingPredictionsCount > 0 && (
                <PendingPredictions count={data.pendingPredictionsCount} />
              )}
            </div>
          ) : (
            <TudoEmDia />
          )}
        </section>

        {hasInfo && (
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Informação
            </h3>
            <div className="flex flex-col gap-3">
              {data.awaitingResultsCount > 0 && (
                <AwaitingResults count={data.awaitingResultsCount} />
              )}
              {data.pointsPossible > 0 && (
                <PointsProgress
                  earned={data.pointsEarned}
                  possible={data.pointsPossible}
                />
              )}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
