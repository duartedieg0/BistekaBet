import { Badge } from "@/components/ui/badge";
import { formatKickoff } from "@/lib/dates/sao-paulo-day";

export function RescheduledBadge({
  originalKickoff,
}: {
  originalKickoff: string | null;
}) {
  if (!originalKickoff) return null;
  return (
    <Badge
      variant="outline"
      className="text-muted-foreground"
      title={`Originalmente: ${formatKickoff(originalKickoff)}`}
    >
      Remarcado
    </Badge>
  );
}
