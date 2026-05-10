"use client";

import { Radio } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { flagSrc } from "@/lib/flags";
import { cn } from "@/lib/utils";

export type MockLiveMatch = {
  id: string;
  home: { code: string; name: string };
  away: { code: string; name: string };
  homeScore: number;
  awayScore: number;
  minute: string;
  period: "1T" | "INT" | "2T" | "PRO" | "PEN";
};

export const MOCK_LIVE: MockLiveMatch[] = [
  {
    id: "mock-live-1",
    home: { code: "BRA", name: "Brasil" },
    away: { code: "ARG", name: "Argentina" },
    homeScore: 2,
    awayScore: 1,
    minute: "67'",
    period: "2T",
  },
];

export function LiveMatchesMock({ matches = MOCK_LIVE }: { matches?: MockLiveMatch[] }) {
  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <Radio className="size-6 opacity-60" aria-hidden />
        <p className="text-sm">Nenhum jogo rolando agora.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {matches.map((m) => (
        <LiveCard key={m.id} match={m} />
      ))}
    </div>
  );
}

function LiveCard({ match }: { match: MockLiveMatch }) {
  return (
    <Card size="sm">
      <CardContent className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-4">
        <TeamSlot code={match.home.code} name={match.home.name} align="end" />
        <div className="flex flex-col items-center gap-1">
          <Badge
            role="status"
            aria-label={`Ao vivo, ${match.minute}`}
            className="gap-1.5 bg-red-600 text-white hover:bg-red-600"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden />
            AO VIVO
          </Badge>
          <div className="font-heading text-2xl tabular-nums leading-none">
            {match.homeScore} <span className="opacity-50">×</span> {match.awayScore}
          </div>
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {match.minute}
          </span>
        </div>
        <TeamSlot code={match.away.code} name={match.away.name} align="start" />
      </CardContent>
    </Card>
  );
}

function TeamSlot({
  code,
  name,
  align,
}: {
  code: string;
  name: string;
  align: "start" | "end";
}) {
  const flag = flagSrc(code, 80);
  const flagEl = flag ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flag}
      alt=""
      width={24}
      height={18}
      loading="lazy"
      className="h-[18px] w-6 rounded-sm object-cover shrink-0"
    />
  ) : (
    <span className="h-[18px] w-6 rounded-sm bg-muted shrink-0" aria-hidden />
  );
  return (
    <div className={cn("flex items-center gap-2 min-w-0", align === "end" ? "justify-end" : "justify-start")}>
      {align === "end" ? (
        <>
          <span className="text-sm truncate" title={name}>
            <span className="hidden sm:inline">{name}</span>
            <span className="font-mono text-xs text-muted-foreground sm:ml-1">{code}</span>
          </span>
          {flagEl}
        </>
      ) : (
        <>
          {flagEl}
          <span className="text-sm truncate" title={name}>
            <span className="font-mono text-xs text-muted-foreground sm:mr-1">{code}</span>
            <span className="hidden sm:inline">{name}</span>
          </span>
        </>
      )}
    </div>
  );
}
