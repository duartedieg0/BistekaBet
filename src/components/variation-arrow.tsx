import { ArrowDown, ArrowUp } from "lucide-react";

/** Seta de variação de posição. delta > 0 = subiu, < 0 = desceu, 0 = nada. */
export function VariationArrow({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span
        className="inline-flex items-center text-[10px] font-medium text-emerald-600"
        aria-label={`subiu ${delta} posições`}
      >
        <ArrowUp className="size-3" aria-hidden />
        {delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span
        className="inline-flex items-center text-[10px] font-medium text-red-600"
        aria-label={`desceu ${-delta} posições`}
      >
        <ArrowDown className="size-3" aria-hidden />
        {-delta}
      </span>
    );
  }
  return null;
}
