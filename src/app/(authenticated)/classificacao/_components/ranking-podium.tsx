import { Crown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/app/(authenticated)/_components/avatar-fallback";
import { MEDAL_COLORS } from "@/lib/scoring/medal";
import { cn } from "@/lib/utils";
import type { RankingRow } from "@/lib/scoring/ranking-core";

function PodiumCard({ row, champion }: { row: RankingRow; champion: boolean }) {
  const medal = MEDAL_COLORS[row.rank] ?? "text-muted-foreground";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-2 rounded-xl border border-border bg-card px-3 text-center",
        champion ? "pt-5 pb-8 ring-2 ring-yellow-500/40" : "pt-4 pb-4",
      )}
    >
      {champion && <Crown className="size-5 text-yellow-500" aria-hidden />}
      <Avatar
        className={cn(
          "ring-2 ring-primary/20",
          champion ? "size-16 sm:size-20" : "size-12 sm:size-14",
        )}
      >
        {row.avatar_url ? <AvatarImage src={row.avatar_url} alt="" /> : null}
        <AvatarFallback className="font-heading uppercase">
          {getInitials(row.display_name)}
        </AvatarFallback>
      </Avatar>
      <span
        className={cn(
          "font-heading tabular-nums",
          medal,
          champion ? "text-2xl" : "text-xl",
        )}
      >
        {row.rank}º
      </span>
      <p className="min-w-0 max-w-full truncate font-medium">
        {row.display_name}
      </p>
      <p
        className={cn(
          "font-heading tabular-nums",
          champion ? "text-3xl" : "text-2xl",
        )}
      >
        {row.total_points}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          pts
        </span>
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {row.exacts_total} exatos
      </p>
    </div>
  );
}

// rows: top 3 na ordem de classificação (índice 0 = 1º). Render na ordem
// visual 2º | 1º | 3º, com o 1º (índice 0) ao centro e realçado.
const VISUAL_ORDER = [1, 0, 2];

export function RankingPodium({ rows }: { rows: RankingRow[] }) {
  return (
    <section
      aria-label="Pódio — top 3"
      className="flex items-end justify-center gap-3 sm:gap-6"
    >
      {VISUAL_ORDER.map((idx) => {
        const row = rows[idx];
        if (!row) return null;
        return <PodiumCard key={row.user_id} row={row} champion={idx === 0} />;
      })}
    </section>
  );
}
