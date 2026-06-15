import { describe, expect, it } from "vitest";
import { filterByName } from "../search-filter";

type Row = { display_name: string };

const rows: Row[] = [
  { display_name: "Ana Lúcia" },
  { display_name: "Bruno" },
  { display_name: "João Pedro" },
  { display_name: "Renata Café" },
];

describe("filterByName", () => {
  it("retorna a lista íntegra quando a query é vazia", () => {
    expect(filterByName(rows, "").map((r) => r.display_name)).toEqual(
      rows.map((r) => r.display_name),
    );
  });

  it("é case-insensitive", () => {
    expect(filterByName(rows, "bruno").map((r) => r.display_name)).toEqual(["Bruno"]);
  });

  it("é accent-insensitive", () => {
    expect(filterByName(rows, "lucia").map((r) => r.display_name)).toEqual(["Ana Lúcia"]);
    expect(filterByName(rows, "cafe").map((r) => r.display_name)).toEqual(["Renata Café"]);
  });

  it("faz match parcial em qualquer posição", () => {
    expect(filterByName(rows, "pedro").map((r) => r.display_name)).toEqual(["João Pedro"]);
  });

  it("retorna lista vazia quando ninguém bate", () => {
    expect(filterByName(rows, "xyz")).toEqual([]);
  });

  it("ignora espaços nas pontas da query", () => {
    expect(filterByName(rows, "  bruno  ").map((r) => r.display_name)).toEqual(["Bruno"]);
  });
});
