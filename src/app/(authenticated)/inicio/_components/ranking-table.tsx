import Link from "next/link";
import { Medal } from "lucide-react";
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

const MEDAL_COLORS: Record<number, string> = {
  1: "text-yellow-500",
  2: "text-gray-400",
  3: "text-amber-700",
};

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
            <TableHead className="w-24 text-center">Status</TableHead>
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
      <p className="mt-3 text-xs text-muted-foreground">
        Top 3 levam 1 camisa da Seleção Brasileira.{" "}
        <Link
          href="/regulamento#premiacao"
          className="underline hover:text-foreground"
        >
          Ver premiação no regulamento
        </Link>
        .
      </p>
    </>
  );
}
