import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RankingRow } from "@/lib/scoring/ranking-core";

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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-right">#</TableHead>
          <TableHead>Participante</TableHead>
          <TableHead className="w-24 text-center">Status</TableHead>
          <TableHead className="w-20 text-right">Pontos</TableHead>
          <TableHead className="w-20 text-right">Exatos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.user_id}>
            <TableCell className="text-right font-semibold tabular-nums">
              {r.rank}
            </TableCell>
            <TableCell className="font-medium">{r.display_name}</TableCell>
            <TableCell className="text-center">
              {r.paid ? (
                <Badge>Pago</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Pendente
                </Badge>
              )}
            </TableCell>
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
  );
}
