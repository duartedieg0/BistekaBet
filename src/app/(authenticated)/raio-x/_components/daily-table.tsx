import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { VariationArrow } from "@/components/variation-arrow";
import { formatDayDdMm } from "@/lib/dates/sao-paulo-day";
import type { TimelinePoint } from "@/lib/scoring/raio-x-core";
import { cn } from "@/lib/utils";

export function DailyTable({ timeline }: { timeline: TimelinePoint[] }) {
  const rows = [...timeline].reverse(); // mais recente no topo

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dia</TableHead>
          <TableHead className="text-right">Jogos</TableHead>
          <TableHead className="text-right">Pts dia</TableHead>
          <TableHead className="text-right">Posição</TableHead>
          <TableHead className="w-14 text-right">Var.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.day}>
            <TableCell className="font-medium">
              <div className="flex flex-col items-start gap-1.5">
                <span>{formatDayDdMm(r.day)}</span>
                <Link
                  href={`/palpites?view=date&date=${r.day}`}
                  aria-label={`Ver palpites de ${formatDayDdMm(r.day)}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "xs" }),
                    "rounded-full",
                  )}
                >
                  Ver palpites
                </Link>
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{r.matchesThatDay}</TableCell>
            <TableCell className="text-right tabular-nums">{r.pointsThatDay}</TableCell>
            <TableCell className="text-right tabular-nums font-semibold">#{r.rank}</TableCell>
            <TableCell className="text-right">
              <span className="inline-flex justify-end">
                <VariationArrow delta={r.delta} />
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
