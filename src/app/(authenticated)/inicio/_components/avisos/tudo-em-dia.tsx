import { CheckCircle2 } from "lucide-react";

export function TudoEmDia() {
  return (
    <div className="flex items-start gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Tudo em dia</span>
        <span className="text-muted-foreground">Você não tem pendências.</span>
      </div>
    </div>
  );
}
