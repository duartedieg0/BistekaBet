import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RankingRow } from "@/lib/scoring/ranking-core";

// rows: participantes a partir do 4º (a página passa rows.slice(3)).
// Destaque na faixa 4º–10º via rank <= 10 (a lista já começa após o pódio).
export function RankingList({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) return null;

  return (
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
        {rows.map((r) => {
          const highlighted = r.rank <= 10;
          return (
            <TableRow
              key={r.user_id}
              className={cn(
                highlighted &&
                  "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary",
              )}
            >
              <TableCell
                className={cn(
                  "text-right font-semibold tabular-nums",
                  highlighted && "text-primary",
                )}
              >
                {r.rank}
              </TableCell>
              <TableCell className="font-medium">{r.display_name}</TableCell>
              <TableCell className="text-right tabular-nums">
                {r.total_points}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.exacts_total}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
