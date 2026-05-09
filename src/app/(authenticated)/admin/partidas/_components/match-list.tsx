import Link from "next/link";
import { deriveMatchStatus } from "@/lib/match-status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Match, Team } from "@/lib/types/match";
import { RescheduledBadge } from "@/app/(authenticated)/palpites/_components/rescheduled-badge";

export type MatchWithTeams = Match & {
  home_team: Pick<Team, "id" | "code" | "name"> | null;
  away_team: Pick<Team, "id" | "code" | "name"> | null;
};

function formatScore(m: Match): string {
  if (m.home_score === null || m.away_score === null) return "—";
  const base = `${m.home_score} × ${m.away_score}`;
  if (m.home_pens !== null && m.away_pens !== null) {
    return `${base} (pen ${m.home_pens} × ${m.away_pens})`;
  }
  if (m.home_score_et !== null && m.away_score_et !== null) {
    return `${m.home_score_et} × ${m.away_score_et} (após prorrog.)`;
  }
  return base;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  live: "Ao vivo",
  finished: "Encerrado",
  postponed: "Adiado",
  cancelled: "Cancelado",
};

export function MatchList({ matches }: { matches: MatchWithTeams[] }) {
  if (!matches.length) {
    return <p className="text-sm text-muted-foreground">Nenhum jogo para esta fase ainda.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data/hora</TableHead>
          <TableHead>Mandante</TableHead>
          <TableHead className="text-center">Placar</TableHead>
          <TableHead>Visitante</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-24">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {matches.map((m) => {
          const status = deriveMatchStatus(m);
          return (
            <TableRow key={m.id}>
              <TableCell>
                <span className="inline-flex items-center gap-2">
                  {new Date(m.kickoff_at).toLocaleString("pt-BR")}
                  <RescheduledBadge originalKickoff={m.original_kickoff_at} />
                </span>
              </TableCell>
              <TableCell>{m.home_team?.name ?? "—"}</TableCell>
              <TableCell className="text-center font-mono">{formatScore(m)}</TableCell>
              <TableCell>{m.away_team?.name ?? "—"}</TableCell>
              <TableCell>{STATUS_LABEL[status]}</TableCell>
              <TableCell>
                <Link href={`/admin/partidas/${m.id}`} className="text-sm underline">Editar</Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
