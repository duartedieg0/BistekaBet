import { Crown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/app/(authenticated)/_components/avatar-fallback";
import { cn } from "@/lib/utils";
import type { RankingRow } from "@/lib/scoring/ranking-core";

// Marca fixa (palco imersivo): usamos a paleta da marca via valores arbitrários
// para o "wow" do pódio ficar idêntico em light/dark, seguindo o precedente do
// share-card da retrospectiva. Texto cream/gold sobre vinho => contraste alto.
const GOLD = "#F2B33D";
const INK = "#211A17";
const RED = "#D23A2B";
const RED_DEEP = "#A82415";

type Medal = {
  ring: string; // classe de anel do avatar (cor da medalha)
  chip: string; // fundo do chip de colocação
  chipText: string; // texto do chip
  label: string; // rótulo (Campeão/Vice/3º)
  points: string; // cor do total de pontos
};

// Estilo da medalha por colocação real (row.rank). Empates aparecem honestamente.
const MEDALS: Record<number, Medal> = {
  1: {
    ring: "ring-[#F2B33D]",
    chip: "bg-[#F2B33D]",
    chipText: "text-[#211A17]",
    label: "Campeão",
    points: "text-[#F2B33D]",
  },
  2: {
    ring: "ring-[#CBD1D8]",
    chip: "bg-[#CBD1D8]",
    chipText: "text-[#211A17]",
    label: "Vice",
    points: "text-[#FBF8F3]",
  },
  3: {
    ring: "ring-[#CD7F45]",
    chip: "bg-[#CD7F45]",
    chipText: "text-[#FBF8F3]",
    label: "3º lugar",
    points: "text-[#FBF8F3]",
  },
};

// Alturas do pedestal por posição no pódio (place 0 = centro/1º, mais alto).
const PEDESTAL_H = ["h-24 sm:h-28", "h-16 sm:h-20", "h-11 sm:h-14"];
// Ordem de renderização: 2º | 1º | 3º (1º ao centro).
const VISUAL_ORDER = [1, 0, 2];

function PodiumCard({
  row,
  place,
  delay,
}: {
  row: RankingRow;
  place: number; // 0 = 1º (centro), 1 = 2º, 2 = 3º
  delay: number;
}) {
  const champion = place === 0;
  const medal = MEDALS[row.rank] ?? MEDALS[3];

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center duration-500 ease-out animate-in fade-in slide-in-from-bottom-4",
        champion ? "max-w-[46%]" : "max-w-[34%]",
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      {/* Conteúdo flutuante acima do pedestal */}
      <div
        className="relative flex w-full flex-col items-center gap-2 rounded-2xl px-2 pb-4 pt-5 text-center"
        style={{
          background: "rgba(251, 248, 243, 0.06)",
          border: champion
            ? "1px solid rgba(242, 179, 61, 0.55)"
            : "1px solid rgba(251, 248, 243, 0.14)",
          boxShadow: champion
            ? "0 18px 40px -12px rgba(242,179,61,0.45), inset 0 1px 0 0 rgba(251,248,243,0.10)"
            : "inset 0 1px 0 0 rgba(251,248,243,0.08)",
        }}
      >
        {champion && (
          <Crown
            className="absolute -top-6 size-7 animate-float text-[#F2B33D] drop-shadow"
            aria-hidden
          />
        )}

        <Avatar
          className={cn(
            "ring-2",
            medal.ring,
            champion ? "size-16 sm:size-20" : "size-12 sm:size-14",
          )}
        >
          {row.avatar_url ? <AvatarImage src={row.avatar_url} alt="" /> : null}
          <AvatarFallback className="bg-white/10 font-heading uppercase text-[#FBF8F3]">
            {getInitials(row.display_name)}
          </AvatarFallback>
        </Avatar>

        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
            medal.chip,
            medal.chipText,
          )}
        >
          {medal.label}
        </span>

        <p className="w-full truncate px-1 text-sm font-semibold text-[#FBF8F3]">
          {row.display_name}
        </p>

        <p className="flex items-baseline gap-1 leading-none">
          <span
            className={cn(
              "font-heading tabular-nums",
              medal.points,
              champion ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl",
            )}
          >
            {row.total_points}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-[#FBF8F3]/60">
            pts
          </span>
        </p>

        <p className="text-[11px] tabular-nums text-[#FBF8F3]/60">
          {row.exacts_total} exatos
        </p>
      </div>

      {/* Pedestal — altura em escada; borda superior na cor da medalha */}
      <div
        className={cn(
          "mt-2 flex w-full items-start justify-center rounded-b-xl pt-2",
          PEDESTAL_H[place],
        )}
        style={{
          background:
            "linear-gradient(180deg, rgba(251,248,243,0.12) 0%, rgba(251,248,243,0.03) 100%)",
          borderTop: `3px solid ${champion ? GOLD : "rgba(251,248,243,0.35)"}`,
        }}
      >
        <span className="font-heading text-2xl tabular-nums text-[#FBF8F3]/70 sm:text-3xl">
          {row.rank}
        </span>
      </div>
    </div>
  );
}

export function RankingPodium({ rows }: { rows: RankingRow[] }) {
  return (
    <section
      aria-label="Pódio — top 3"
      className="relative overflow-hidden rounded-3xl px-3 pb-6 pt-8 shadow-lg sm:px-8 sm:pb-8 sm:pt-10"
      style={{
        background: `linear-gradient(160deg, ${INK} 0%, ${RED_DEEP} 55%, ${RED} 100%)`,
      }}
    >
      {/* Barra dourada superior */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: GOLD }}
      />
      {/* Glow dourado atrás do campeão + orb de profundidade */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, rgba(242,179,61,0.30) 0%, rgba(242,179,61,0) 55%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full"
        style={{ background: "rgba(242,179,61,0.12)", filter: "blur(8px)" }}
      />

      <p
        className="relative mb-6 text-center text-[11px] font-bold uppercase tracking-[0.28em]"
        style={{ color: GOLD }}
      >
        Pódio · Copa 2026
      </p>

      <div className="relative flex items-end justify-center gap-2 sm:gap-4">
        {VISUAL_ORDER.map((idx, i) => {
          const row = rows[idx];
          if (!row) return null;
          return (
            <PodiumCard key={row.user_id} row={row} place={idx} delay={i * 120} />
          );
        })}
      </div>
    </section>
  );
}
