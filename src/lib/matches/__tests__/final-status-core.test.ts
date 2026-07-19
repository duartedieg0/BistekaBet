import { describe, it, expect } from "vitest";
import { finalDecidedFromRow } from "@/lib/matches/final-status-core";

describe("finalDecidedFromRow", () => {
  it("null (nenhuma final encontrada) → false", () => {
    expect(finalDecidedFromRow(null)).toBe(false);
  });

  it("final ainda sem vencedor → false", () => {
    expect(finalDecidedFromRow({ winner_team_id: null })).toBe(false);
  });

  it("final decidida (com winner_team_id) → true", () => {
    expect(finalDecidedFromRow({ winner_team_id: "team-uuid" })).toBe(true);
  });
});
