"use client";

import { Radio } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { flagSrc } from "@/lib/flags";
import { cn } from "@/lib/utils";

export type MatchEventSide = "home" | "away";

export type MatchEvent =
  | { kind: "goal"; minute: number; player: string; side: MatchEventSide }
  | { kind: "card"; color: "yellow" | "red"; minute: number; player: string; side: MatchEventSide };

export type MockLiveMatch = {
  id: string;
  home: { code: string; name: string };
  away: { code: string; name: string };
  homeScore: number;
  awayScore: number;
  minute: string;
  period: "1T" | "INT" | "2T" | "PRO" | "PEN";
  events: MatchEvent[];
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
    events: [
      { kind: "goal", minute: 15, player: "Julián Alvarez", side: "away" },
      { kind: "card", color: "yellow", minute: 33, player: "Casimiro", side: "home" },
      { kind: "card", color: "red", minute: 44, player: "de Paul", side: "away" },
      { kind: "goal", minute: 51, player: "Rayan", side: "home" },
      { kind: "goal", minute: 63, player: "Rayan", side: "home" },
    ],
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
  const homeEvents = match.events.filter((e) => e.side === "home");
  const awayEvents = match.events.filter((e) => e.side === "away");
  const sortByMinute = (a: MatchEvent, b: MatchEvent) => a.minute - b.minute;

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
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
        </div>

        {match.events.length > 0 && (
          <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-3 text-xs">
            <ul className="flex flex-col items-end gap-1">
              {[...homeEvents].sort(sortByMinute).map((e, i) => (
                <EventLine key={`h-${i}`} event={e} align="end" />
              ))}
            </ul>
            <ul className="flex flex-col items-start gap-1">
              {[...awayEvents].sort(sortByMinute).map((e, i) => (
                <EventLine key={`a-${i}`} event={e} align="start" />
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EventLine({ event, align }: { event: MatchEvent; align: "start" | "end" }) {
  const minute = `${event.minute}'`;
  const icon = (() => {
    if (event.kind === "goal") return <span aria-hidden>⚽</span>;
    const color = event.color === "red" ? "bg-red-600" : "bg-yellow-400";
    return (
      <span
        aria-hidden
        className={cn("inline-block h-3 w-2 rounded-[1px]", color)}
      />
    );
  })();

  const label =
    event.kind === "goal"
      ? `Gol de ${event.player}`
      : `Cartão ${event.color === "red" ? "vermelho" : "amarelo"} para ${event.player}`;

  const minuteEl = (
    <span className="font-mono tabular-nums text-muted-foreground">{minute}</span>
  );
  const playerEl = <span className="truncate">{event.player}</span>;

  return (
    <li
      className={cn(
        "flex items-center gap-1.5",
        align === "end" ? "flex-row-reverse text-right" : "flex-row text-left",
      )}
      aria-label={`${minute} — ${label}`}
    >
      {icon}
      {playerEl}
      {minuteEl}
    </li>
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
