"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Match, Team } from "@/lib/types/match";
import { updateMatch } from "../_actions";
import { toSaoPauloInputValue, formatKickoff } from "@/lib/dates/sao-paulo-day";

export function MatchForm({ match, teams }: { match: Match; teams: Team[] }) {
  const isKnockout = match.stage !== "group";
  const [showET, setShowET] = useState(match.home_score_et !== null);
  const [showPens, setShowPens] = useState(match.home_pens !== null);

  const action = updateMatch.bind(null, match.id);

  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="kickoff_at">Início</Label>
          <Input
            id="kickoff_at"
            name="kickoff_at"
            type="datetime-local"
            defaultValue={toSaoPauloInputValue(match.kickoff_at)}
            required
          />
          {match.original_kickoff_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Kickoff original: {formatKickoff(match.original_kickoff_at)}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="venue">Sede</Label>
          <Input id="venue" name="venue" defaultValue={match.venue ?? ""} />
        </div>
        <TeamSelect name="home_team_id" label="Mandante" teams={teams} value={match.home_team_id} />
        <TeamSelect name="away_team_id" label="Visitante" teams={teams} value={match.away_team_id} />
      </div>

      <fieldset className="border rounded-md p-4">
        <legend className="px-2 text-sm font-semibold">Resultado (90 min)</legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="home_score">Mandante</Label>
            <Input id="home_score" name="home_score" type="number" min={0} defaultValue={match.home_score ?? ""} />
          </div>
          <div>
            <Label htmlFor="away_score">Visitante</Label>
            <Input id="away_score" name="away_score" type="number" min={0} defaultValue={match.away_score ?? ""} />
          </div>
        </div>
      </fieldset>

      {isKnockout ? (
        <>
          <div className="flex items-center gap-3">
            <input
              id="toggle-et"
              type="checkbox"
              checked={showET}
              onChange={(e) => setShowET(e.target.checked)}
            />
            <Label htmlFor="toggle-et">Houve prorrogação</Label>
          </div>
          {showET ? (
            <fieldset className="border rounded-md p-4">
              <legend className="px-2 text-sm font-semibold">Prorrogação (acumulado)</legend>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="home_score_et">Mandante</Label>
                  <Input id="home_score_et" name="home_score_et" type="number" min={0} defaultValue={match.home_score_et ?? ""} />
                </div>
                <div>
                  <Label htmlFor="away_score_et">Visitante</Label>
                  <Input id="away_score_et" name="away_score_et" type="number" min={0} defaultValue={match.away_score_et ?? ""} />
                </div>
              </div>
            </fieldset>
          ) : null}

          <div className="flex items-center gap-3">
            <input
              id="toggle-pens"
              type="checkbox"
              checked={showPens}
              onChange={(e) => setShowPens(e.target.checked)}
              disabled={!showET}
            />
            <Label htmlFor="toggle-pens">Decidiu nos pênaltis</Label>
          </div>
          {showPens ? (
            <fieldset className="border rounded-md p-4">
              <legend className="px-2 text-sm font-semibold">Pênaltis</legend>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="home_pens">Mandante</Label>
                  <Input id="home_pens" name="home_pens" type="number" min={0} defaultValue={match.home_pens ?? ""} />
                </div>
                <div>
                  <Label htmlFor="away_pens">Visitante</Label>
                  <Input id="away_pens" name="away_pens" type="number" min={0} defaultValue={match.away_pens ?? ""} />
                </div>
              </div>
            </fieldset>
          ) : null}

          <TeamSelect name="winner_team_id" label="Vencedor" teams={teams} value={match.winner_team_id} />
        </>
      ) : null}

      <div>
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={match.status ?? ""}
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— derivado automaticamente —</option>
          <option value="postponed">Adiado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      <div className="flex gap-2">
        <Button type="submit">Salvar</Button>
        <Link href="/admin/partidas" className={buttonVariants({ variant: "outline" })}>Cancelar</Link>
      </div>
    </form>
  );
}

function TeamSelect({
  name,
  label,
  teams,
  value,
}: {
  name: string;
  label: string;
  teams: Team[];
  value: string | null;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={value ?? ""}
        className="block w-full rounded-md border bg-background px-3 py-2 text-sm"
      >
        <option value="">— a definir —</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.code} — {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
