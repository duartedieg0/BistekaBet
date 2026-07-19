import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/app/(authenticated)/_components/avatar-fallback";
import { cn } from "@/lib/utils";
import type { RankingRow } from "@/lib/scoring/ranking-core";

function RankBadge({ rank, highlighted }: { rank: number; highlighted: boolean }) {
  if (highlighted) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent font-heading text-sm tabular-nums text-accent-foreground shadow-sm">
        {rank}
      </span>
    );
  }
  return (
    <span className="inline-flex size-7 items-center justify-center font-semibold tabular-nums text-muted-foreground">
      {rank}
    </span>
  );
}

// rows: participantes a partir do 4º (a página passa rows.slice(3)).
// Destaque na faixa 4º–10º via rank <= 10 (a lista já começa após o pódio).
// O tom dourado (accent) dá continuidade à "aura" do pódio; o realce não depende
// só de cor (badge circular + filete à esquerda reforçam).
export function RankingList({ rows }: { rows: RankingRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-16 pl-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              #
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Participante
            </TableHead>
            <TableHead className="w-20 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pontos
            </TableHead>
            <TableHead className="w-20 pr-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Exatos
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const highlighted = r.rank <= 10;
            return (
              <TableRow
                key={r.user_id}
                className={cn(
                  "transition-colors",
                  highlighted &&
                    "border-l-[3px] border-l-accent bg-accent/[0.07] hover:bg-accent/15",
                )}
              >
                <TableCell className="py-2.5 pl-4">
                  <RankBadge rank={r.rank} highlighted={highlighted} />
                </TableCell>
                <TableCell className="py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8 ring-1 ring-border">
                      {r.avatar_url ? (
                        <AvatarImage src={r.avatar_url} alt="" />
                      ) : null}
                      <AvatarFallback className="text-xs font-medium uppercase">
                        {getInitials(r.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 truncate font-medium">
                      {r.display_name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-2.5 text-right">
                  <span className="font-heading text-lg tabular-nums">
                    {r.total_points}
                  </span>
                </TableCell>
                <TableCell className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                  {r.exacts_total}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
