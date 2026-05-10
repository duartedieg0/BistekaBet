"use client";

import { useState } from "react";
import { CalendarDays, Radio } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MatchWithPrediction } from "@/lib/types/prediction";
import { UpcomingMatchesList } from "./upcoming-matches-list";
import { LiveMatchesMock, MOCK_LIVE } from "./live-matches-mock";

type Tab = "upcoming" | "live";

export function InicioMatchesTabs({
  matches,
  dayLabel,
}: {
  matches: MatchWithPrediction[];
  dayLabel: string | null;
}) {
  const liveCount = MOCK_LIVE.length;
  const [tab, setTab] = useState<Tab>(liveCount > 0 ? "live" : "upcoming");

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex flex-col gap-4">
      <TabsList className="self-start">
        <TabsTrigger value="upcoming" className="gap-2">
          <CalendarDays className="size-4" aria-hidden />
          Próximos jogos
        </TabsTrigger>
        <TabsTrigger value="live" className="gap-2">
          <Radio className="size-4" aria-hidden />
          Ao vivo
          {liveCount > 0 ? (
            <span
              className="ml-1 inline-flex size-1.5 rounded-full bg-red-600 animate-pulse"
              aria-label={`${liveCount} ao vivo`}
            />
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming" className="m-0">
        <UpcomingMatchesList matches={matches} dayLabel={dayLabel} />
      </TabsContent>
      <TabsContent value="live" className="m-0">
        <LiveMatchesMock />
      </TabsContent>
    </Tabs>
  );
}
