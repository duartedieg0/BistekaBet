import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { flagSrc } from "@/lib/flags";
import { formatKickoff } from "@/lib/dates/sao-paulo-day";
import { STAGE_LABELS } from "@/lib/types/match";
import type { MatchWithTeams } from "../_lib/get-match-predictions";

function statusLabel(match: MatchWithTeams): string {
  if (match.status === "cancelled") return "Partida cancelada";
  if (match.status === "postponed") return "Partida adiada";
  if (match.home_score === null || match.away_score === null) {
    return "Aguardando resultado oficial";
  }
  return "Resultado oficial";
}

function TeamBlock({
  name,
  code,
  align,
}: {
  name: string;
  code: string;
  align: "start" | "end";
}) {
  const flag = flagSrc(code, 80);
  return (
    <div
      className={`flex items-center gap-3 ${align === "end" ? "justify-end" : "justify-start"}`}
    >
      {align === "start" && flag ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flag} alt="" width={28} height={21} className="rounded-sm" />
      ) : null}
      <span className="text-base font-semibold sm:text-lg">{name}</span>
      {align === "end" && flag ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flag} alt="" width={28} height={21} className="rounded-sm" />
      ) : null}
    </div>
  );
}

export function MatchHeader({ match }: { match: MatchWithTeams }) {
  const home = match.home_team;
  const away = match.away_team;
  const hasResult =
    match.home_score !== null &&
    match.away_score !== null &&
    match.status !== "cancelled" &&
    match.status !== "postponed";

  return (
    <header className="flex flex-col gap-4 pb-6">
      <Link
        href="/palpites"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Voltar
      </Link>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {STAGE_LABELS[match.stage]}
        </p>
        <p className="text-sm text-muted-foreground">{formatKickoff(match.kickoff_at)}</p>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-md border bg-card p-4">
        <TeamBlock name={home?.name ?? "A definir"} code={home?.code ?? "TBD"} align="end" />
        {hasResult ? (
          <span className="font-heading text-2xl tabular-nums">
            {match.home_score} <span className="opacity-50">×</span> {match.away_score}
          </span>
        ) : (
          <span className="font-heading text-2xl text-muted-foreground">×</span>
        )}
        <TeamBlock name={away?.name ?? "A definir"} code={away?.code ?? "TBD"} align="start" />
      </div>

      <Badge variant="secondary" className="self-start">
        {statusLabel(match)}
      </Badge>
    </header>
  );
}
