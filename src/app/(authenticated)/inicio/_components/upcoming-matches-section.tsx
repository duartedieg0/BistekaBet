import { CalendarDays } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatSaoPauloDayLabel } from "@/lib/dates/sao-paulo-day";
import { getInicioDayMatches } from "../_lib/queries";
import { UpcomingMatchesList } from "./upcoming-matches-list";
import { WhatsappReminderToggle } from "./whatsapp-reminder-toggle";

export async function UpcomingMatchesSection() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const [{ matches, referenceDate, isToday }, profileRes] = await Promise.all([
    getInicioDayMatches(supabase, userData.user.id),
    supabase
      .from("profiles")
      .select("notify_whatsapp")
      .eq("id", userData.user.id)
      .single<{ notify_whatsapp: boolean }>(),
  ]);

  const notifyWhatsapp = profileRes.data?.notify_whatsapp ?? true;

  const dayLabel = referenceDate
    ? formatSaoPauloDayLabel(referenceDate, { isToday })
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <CardTitle className="inline-flex items-center gap-2 font-heading text-xl tracking-wide">
          <CalendarDays className="size-5 text-primary" />
          Próximos jogos
        </CardTitle>
        <WhatsappReminderToggle initialEnabled={notifyWhatsapp} />
      </CardHeader>
      <CardContent>
        <UpcomingMatchesList matches={matches} dayLabel={dayLabel} />
      </CardContent>
    </Card>
  );
}
