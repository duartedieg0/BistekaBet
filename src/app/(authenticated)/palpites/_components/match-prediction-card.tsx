"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MatchWithPrediction } from "@/lib/types/prediction";
import { savePrediction } from "../_actions";
import { bracketSlotLabel } from "../_lib/bracket-labels";
import { useGroupSave } from "./group-save-form";

export function MatchPredictionCard({ match }: { match: MatchWithPrediction }) {
  const isKnockout = match.stage !== "group";
  const isClosed = new Date(match.kickoff_at).getTime() <= Date.now();

  const [home, setHome] = useState<string>(match.prediction?.home_score?.toString() ?? "");
  const [away, setAway] = useState<string>(match.prediction?.away_score?.toString() ?? "");
  const [advancesTeamId, setAdvancesTeamId] = useState<string | null>(match.prediction?.advances_team_id ?? null);
  const [advancesSlot, setAdvancesSlot] = useState<"home" | "away" | null>(match.prediction?.advances_slot ?? null);
  const [isPending, startTransition] = useTransition();
  const [savedTick, setSavedTick] = useState(false);

  const homeNum = home === "" ? null : Number(home);
  const awayNum = away === "" ? null : Number(away);
  const isDraw = homeNum !== null && awayNum !== null && homeNum === awayNum;
  const knockoutNeedsAdvance = isKnockout && isDraw;

  const dirty = useMemo(() => {
    const p = match.prediction;
    if (!p) return home !== "" || away !== "";
    return (
      Number(home) !== p.home_score ||
      Number(away) !== p.away_score ||
      advancesTeamId !== p.advances_team_id ||
      advancesSlot !== p.advances_slot
    );
  }, [home, away, advancesTeamId, advancesSlot, match.prediction]);

  const groupCtx = useGroupSave();

  useEffect(() => {
    if (!groupCtx) return;
    return groupCtx.register(match.id, () => {
      if (isClosed) return null;
      if (!dirty) return null;
      if (validate() !== null) return null;
      return {
        matchId: match.id,
        homeScore: homeNum!,
        awayScore: awayNum!,
        advancesTeamId,
        advancesSlot,
      };
    });
    // validate is closed over local state; safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupCtx, match.id, isClosed, dirty, homeNum, awayNum, advancesTeamId, advancesSlot]);

  const homeLabel = match.home_team?.name ?? bracketSlotLabel(match.stage, match.bracket_position, "home");
  const awayLabel = match.away_team?.name ?? bracketSlotLabel(match.stage, match.bracket_position, "away");
  const homeCode = match.home_team?.code ?? "TBD";
  const awayCode = match.away_team?.code ?? "TBD";

  function validate(): string | null {
    if (homeNum === null || awayNum === null) return "Preencha os dois placares.";
    if (!Number.isInteger(homeNum) || homeNum < 0) return "Placar inválido.";
    if (!Number.isInteger(awayNum) || awayNum < 0) return "Placar inválido.";
    if (knockoutNeedsAdvance && !advancesTeamId && !advancesSlot) return "Escolha quem se classifica.";
    return null;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    startTransition(async () => {
      const res = await savePrediction({
        matchId: match.id,
        homeScore: homeNum!,
        awayScore: awayNum!,
        advancesTeamId,
        advancesSlot,
      });
      if (res.ok) {
        toast.success("Palpite salvo");
        setSavedTick(true);
        setTimeout(() => setSavedTick(false), 2000);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "rounded-lg border bg-card p-4 flex flex-col gap-3",
        isClosed && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{new Date(match.kickoff_at).toLocaleString("pt-BR")}</span>
        {isClosed ? (
          <span className="rounded bg-muted px-2 py-0.5">Encerrado</span>
        ) : match.prediction && !dirty ? (
          <span className="rounded bg-primary/10 text-primary px-2 py-0.5">Salvo</span>
        ) : null}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamSlot label={homeLabel} code={homeCode} flagUrl={match.home_team?.flag_url ?? null} align="end" />
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            value={home}
            onChange={(e) => setHome(e.target.value)}
            disabled={isClosed || isPending}
            aria-label={`Gols ${homeLabel}`}
            className="w-14 text-center"
          />
          <span className="font-bold">×</span>
          <Input
            type="number"
            min={0}
            value={away}
            onChange={(e) => setAway(e.target.value)}
            disabled={isClosed || isPending}
            aria-label={`Gols ${awayLabel}`}
            className="w-14 text-center"
          />
        </div>
        <TeamSlot label={awayLabel} code={awayCode} flagUrl={match.away_team?.flag_url ?? null} align="start" />
      </div>

      {knockoutNeedsAdvance ? (
        <fieldset className="border rounded-md p-3">
          <legend className="px-2 text-xs font-semibold">Quem se classifica?</legend>
          <div className="flex gap-3 text-sm">
            <AdvanceRadio
              checked={
                match.home_team
                  ? advancesTeamId === match.home_team.id
                  : advancesSlot === "home"
              }
              onChange={() => {
                if (match.home_team) {
                  setAdvancesTeamId(match.home_team.id);
                  setAdvancesSlot(null);
                } else {
                  setAdvancesSlot("home");
                  setAdvancesTeamId(null);
                }
              }}
              label={homeLabel}
              disabled={isClosed || isPending}
            />
            <AdvanceRadio
              checked={
                match.away_team
                  ? advancesTeamId === match.away_team.id
                  : advancesSlot === "away"
              }
              onChange={() => {
                if (match.away_team) {
                  setAdvancesTeamId(match.away_team.id);
                  setAdvancesSlot(null);
                } else {
                  setAdvancesSlot("away");
                  setAdvancesTeamId(null);
                }
              }}
              label={awayLabel}
              disabled={isClosed || isPending}
            />
          </div>
        </fieldset>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isClosed || isPending || !dirty}>
          {isPending ? "Salvando..." : savedTick ? "✓ Salvo" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

function TeamSlot({ label, code, flagUrl, align }: { label: string; code: string; flagUrl: string | null; align: "start" | "end" }) {
  return (
    <div className={cn("flex items-center gap-2", align === "end" ? "justify-end" : "justify-start")}>
      {flagUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flagUrl} alt="" className="size-6 rounded-sm" />
      ) : (
        <span className="size-6 rounded-sm bg-muted" />
      )}
      <span className="text-sm" title={label}>
        <span className="font-mono text-xs text-muted-foreground mr-1">{code}</span>
        <span className="hidden sm:inline">{label}</span>
      </span>
    </div>
  );
}

function AdvanceRadio({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input type="radio" checked={checked} onChange={onChange} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}
