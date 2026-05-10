import { CalendarDays } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatSaoPauloDayLabel } from "@/lib/dates/sao-paulo-day";
import { getInicioDayMatches } from "../_lib/queries";
import { InicioMatchesTabs } from "./inicio-matches-tabs";

export async function UpcomingMatchesSection() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const { matches, referenceDate, isToday } = await getInicioDayMatches(
    supabase,
    userData.user.id,
  );

  const dayLabel = referenceDate
    ? formatSaoPauloDayLabel(referenceDate, { isToday })
    : null;

  const now = Date.now();
  const openCount = matches.filter(
    (m) => new Date(m.kickoff_at).getTime() > now,
  ).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="inline-flex items-center gap-2 font-heading text-xl tracking-wide">
          <CalendarDays className="size-5 text-primary" />
          Seus próximos jogos
        </CardTitle>
        {openCount > 0 ? (
          <Badge variant="secondary">
            {openCount} aberto{openCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        <InicioMatchesTabs matches={matches} dayLabel={dayLabel} />
      </CardContent>
    </Card>
  );
}
