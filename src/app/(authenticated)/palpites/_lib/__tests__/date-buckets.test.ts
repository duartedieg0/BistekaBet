import { describe, expect, it } from "vitest";
import {
  bucketMatchesByDate,
  filterMatchesByDate,
  todayInSaoPaulo,
  toSaoPauloDate,
} from "../date-buckets";

describe("toSaoPauloDate", () => {
  it("retorna a data SP de um timestamp UTC durante o dia", () => {
    // 2026-06-15T18:00:00Z = 15:00 SP (UTC-3)
    expect(toSaoPauloDate("2026-06-15T18:00:00Z")).toBe("2026-06-15");
  });

  it("respeita o dia SP quando UTC já está no dia seguinte", () => {
    // 2026-06-16T02:00:00Z = 23:00 SP do dia 15
    expect(toSaoPauloDate("2026-06-16T02:00:00Z")).toBe("2026-06-15");
  });

  it("respeita o dia SP quando UTC ainda está no dia anterior", () => {
    // 2026-06-15T02:59:00Z = 23:59 SP do dia 14
    expect(toSaoPauloDate("2026-06-15T02:59:00Z")).toBe("2026-06-14");
  });
});

describe("todayInSaoPaulo", () => {
  it("retorna formato YYYY-MM-DD", () => {
    const out = todayInSaoPaulo();
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("usa o `now` injetado", () => {
    expect(todayInSaoPaulo(new Date("2026-06-15T18:00:00Z"))).toBe("2026-06-15");
    expect(todayInSaoPaulo(new Date("2026-06-16T02:00:00Z"))).toBe("2026-06-15");
  });
});

describe("bucketMatchesByDate", () => {
  const matches = [
    { id: "a", kickoff_at: "2026-06-15T18:00:00Z" }, // 15/06 SP
    { id: "b", kickoff_at: "2026-06-15T21:00:00Z" }, // 15/06 SP
    { id: "c", kickoff_at: "2026-06-16T18:00:00Z" }, // 16/06 SP
    { id: "d", kickoff_at: "2026-06-14T22:00:00Z" }, // 14/06 SP
  ];

  it("agrupa por dia SP com contagem", () => {
    expect(bucketMatchesByDate(matches)).toEqual([
      { date: "2026-06-14", count: 1 },
      { date: "2026-06-15", count: 2 },
      { date: "2026-06-16", count: 1 },
    ]);
  });

  it("retorna array vazio sem matches", () => {
    expect(bucketMatchesByDate([])).toEqual([]);
  });
});

describe("filterMatchesByDate", () => {
  const matches = [
    { id: "a", kickoff_at: "2026-06-15T18:00:00Z" },
    { id: "b", kickoff_at: "2026-06-16T02:00:00Z" }, // 23:00 SP do dia 15
    { id: "c", kickoff_at: "2026-06-16T18:00:00Z" },
  ];

  it("retorna matches do dia SP", () => {
    const result = filterMatchesByDate(matches, "2026-06-15").map((m) => m.id);
    expect(result).toEqual(["a", "b"]);
  });

  it("retorna vazio quando não há matches no dia", () => {
    expect(filterMatchesByDate(matches, "2026-06-17")).toEqual([]);
  });
});
