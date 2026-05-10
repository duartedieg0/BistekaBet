import { CalendarDays } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatSaoPauloDayLabel } from "@/lib/dates/sao-paulo-day";
import { getInicioDayMatches } from "../_lib/queries";
import { UpcomingMatchesList } from "./upcoming-matches-list";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2 font-heading text-xl tracking-wide">
          <CalendarDays className="size-5 text-primary" />
          Próximos jogos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <UpcomingMatchesList matches={matches} dayLabel={dayLabel} />
      </CardContent>
    </Card>
  );
}
