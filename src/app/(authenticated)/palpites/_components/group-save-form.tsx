"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SavePredictionInput } from "@/lib/validation/prediction";
import { savePredictionsBatch } from "../_actions";

type Collector = () => SavePredictionInput | null;

interface Ctx {
  register: (matchId: string, collector: Collector) => () => void;
  registered: number;
}

const GroupSaveCtx = createContext<Ctx | null>(null);

export function useGroupSave(): Ctx | null {
  return useContext(GroupSaveCtx);
}

export function GroupSaveForm({ children }: { children: React.ReactNode }) {
  const collectorsRef = useRef(new Map<string, Collector>());
  const [registered, setRegistered] = useState(0);
  const [isPending, startTransition] = useTransition();

  const register = useCallback((matchId: string, collector: Collector) => {
    collectorsRef.current.set(matchId, collector);
    setRegistered((n) => n + 1);
    return () => {
      collectorsRef.current.delete(matchId);
      setRegistered((n) => Math.max(0, n - 1));
    };
  }, []);

  const ctx = useMemo<Ctx>(() => ({ register, registered }), [register, registered]);

  function onSaveAll() {
    const inputs: SavePredictionInput[] = [];
    for (const [, collect] of collectorsRef.current) {
      const v = collect();
      if (v) inputs.push(v);
    }
    if (inputs.length === 0) {
      toast.info("Nada para salvar.");
      return;
    }
    startTransition(async () => {
      const res = await savePredictionsBatch(inputs);
      if (res.ok) {
        toast.success(`${inputs.length} palpite(s) salvo(s)`);
      } else {
        toast.error(`Falha ao salvar: ${res.errors.map((e) => e.error).join("; ")}`);
      }
    });
  }

  return (
    <GroupSaveCtx.Provider value={ctx}>
      <div className="relative pb-24">
        {children}
        <div className="pointer-events-none sticky bottom-4 z-10 mt-4 flex justify-end">
          <div className="pointer-events-auto rounded-xl bg-card px-3 py-2 shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm">
            <Button size="sm" onClick={onSaveAll} disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar palpites"}
            </Button>
          </div>
        </div>
      </div>
    </GroupSaveCtx.Provider>
  );
}
