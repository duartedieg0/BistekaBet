import { Badge } from "@/components/ui/badge";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

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
      title={`Originalmente: ${fmt(originalKickoff)}`}
    >
      Remarcado
    </Badge>
  );
}
