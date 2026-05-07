import type { Stage } from "@/lib/types/match";

const STAGE_PREFIX: Record<Stage, string> = {
  group: "Grupo",
  round_of_32: "R32",
  round_of_16: "R16",
  quarter: "QF",
  semi: "SF",
  third_place: "3º",
  final: "Final",
};

/** Label genérico para uma vaga TBD em mata-mata. */
export function bracketSlotLabel(stage: Stage, bracketPosition: number | null, slot: "home" | "away"): string {
  const prefix = STAGE_PREFIX[stage] ?? stage;
  const pos = bracketPosition ?? "?";
  return `${prefix}-${pos} (${slot === "home" ? "esq" : "dir"})`;
}
