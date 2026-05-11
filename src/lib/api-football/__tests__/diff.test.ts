// src/lib/api-football/__tests__/diff.test.ts
import { describe, it, expect } from "vitest";
import { buildDiffEntry } from "@/lib/api-football/diff";
import type { MatchPatch } from "@/lib/api-football/types";

const baseMatch = {
  id: "m1",
  api_football_id: 999,
  home_team_id: "h1", away_team_id: "a1",
  home_team_name: "Brasil", away_team_name: "Argentina",
  home_score: null as number | null,
  away_score: null as number | null,
  home_score_et: null as number | null,
  away_score_et: null as number | null,
  home_pens: null as number | null,
  away_pens: null as number | null,
  winner_team_id: null as string | null,
  status: null as "postponed" | "cancelled" | null,
};

const basePatch = (over: Partial<MatchPatch> = {}): MatchPatch => ({
  api_football_id: 999,
  home_score: 2, away_score: 1,
  home_score_et: null, away_score_et: null,
  home_pens: null, away_pens: null,
  winner_team_id: "h1",
  status: null,
  ...over,
});

describe("buildDiffEntry", () => {
  it("retorna null quando tudo igual", () => {
    const m = { ...baseMatch, home_score: 2, away_score: 1, winner_team_id: "h1" };
    const r = buildDiffEntry(m, basePatch());
    expect(r).toBeNull();
  });

  it("placar mudou → entry com willRecompute=true", () => {
    const r = buildDiffEntry(baseMatch, basePatch());
    expect(r).not.toBeNull();
    expect(r!.willRecompute).toBe(true);
    expect(r!.changes).toEqual(expect.arrayContaining([
      { field: "home_score", from: null, to: 2 },
      { field: "away_score", from: null, to: 1 },
      { field: "winner_team_id", from: null, to: "h1" },
    ]));
    expect(r!.label).toBe("Brasil x Argentina");
  });

  it("só status mudou (postponed→null) → willRecompute=false", () => {
    const m = { ...baseMatch, status: "postponed" as const };
    const patch = basePatch({ home_score: null, away_score: null, winner_team_id: null, status: null });
    const r = buildDiffEntry(m, patch);
    expect(r).not.toBeNull();
    expect(r!.willRecompute).toBe(false);
    expect(r!.changes).toEqual([{ field: "status", from: "postponed", to: null }]);
  });

  it("status mudou para postponed", () => {
    const r = buildDiffEntry(baseMatch, basePatch({
      home_score: null, away_score: null, winner_team_id: null, status: "postponed",
    }));
    expect(r!.changes).toEqual([{ field: "status", from: null, to: "postponed" }]);
    expect(r!.willRecompute).toBe(false);
  });
});
