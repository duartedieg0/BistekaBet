import { Medal } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RankingRow } from "@/lib/scoring/ranking-core";
import { MEDAL_COLORS } from "@/lib/scoring/medal";
import { PremiacaoNote } from "@/app/(authenticated)/_components/premiacao-note";

function RankCell({ rank }: { rank: number }) {
  const color = MEDAL_COLORS[rank];
  if (!color) {
    return <span className="font-semibold tabular-nums">{rank}</span>;
  }
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <Medal className={`size-4 ${color}`} aria-hidden />
      <span className="font-semibold tabular-nums">{rank}</span>
    </span>
  );
}

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        A classificação aparecerá aqui assim que os primeiros resultados forem
        registrados.
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-right">#</TableHead>
            <TableHead>Participante</TableHead>
            <TableHead className="w-20 text-right">Pontos</TableHead>
            <TableHead className="w-20 text-right">Exatos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.user_id}>
              <TableCell className="text-right">
                <RankCell rank={r.rank} />
              </TableCell>
              <TableCell className="font-medium">{r.display_name}</TableCell>
              <TableCell className="text-right tabular-nums">
                {r.total_points}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.exacts_total}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PremiacaoNote className="mt-3" />
    </>
  );
}
