import { describe, it, expect } from "vitest";
import { POINTS_TABLE } from "@/lib/scoring";

describe("POINTS_TABLE (§6 — espelha o regulamento)", () => {
  it("Fase de grupos", () => {
    expect(POINTS_TABLE.group).toEqual({
      winner_or_draw: 2, winner_plus_goals: 4, exact: 7,
    });
  });
  it("32 avos", () => {
    expect(POINTS_TABLE.round_of_32).toEqual({
      winner_or_draw: 3, winner_plus_goals: 6, exact: 10,
    });
  });
  it("Oitavas (round_of_16)", () => {
    expect(POINTS_TABLE.round_of_16).toEqual({
      winner_or_draw: 4, winner_plus_goals: 8, exact: 13,
    });
  });
  it("Quartas", () => {
    expect(POINTS_TABLE.quarter).toEqual({
      winner_or_draw: 6, winner_plus_goals: 11, exact: 18,
    });
  });
  it("Semifinal", () => {
    expect(POINTS_TABLE.semi).toEqual({
      winner_or_draw: 8, winner_plus_goals: 15, exact: 25,
    });
  });
  it("3º lugar (§9)", () => {
    expect(POINTS_TABLE.third_place).toEqual({
      winner_or_draw: 7, winner_plus_goals: 13, exact: 22,
    });
  });
  it("Final", () => {
    expect(POINTS_TABLE.final).toEqual({
      winner_or_draw: 11, winner_plus_goals: 20, exact: 34,
    });
  });
});
