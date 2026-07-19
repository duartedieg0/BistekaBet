// src/app/_components/landing/encerramento/count-up.tsx
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Anima a contagem de 0 até `value` quando entra na viewport. Respeita
 * prefers-reduced-motion (mostra o valor final direto). Sem lib externa.
 */
export function CountUp({
  value,
  durationMs = 1200,
}: {
  value: number;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / durationMs, 1);
          const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
          setDisplay(Math.round(eased * value));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, durationMs]);

  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString("pt-BR")}
    </span>
  );
}
