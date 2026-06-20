import { describe, it, expect, vi } from "vitest";
import { paginateAll } from "@/lib/supabase/paginate";

// Fetcher falso sobre um array em memória; retorna a página [from, to] inclusiva.
function makeFetcher(total: number) {
  const rows = Array.from({ length: total }, (_, i) => i);
  const calls: Array<[number, number]> = [];
  const fetchPage = vi.fn(async (from: number, to: number) => {
    calls.push([from, to]);
    return rows.slice(from, to + 1);
  });
  return { rows, calls, fetchPage };
}

describe("paginateAll", () => {
  it("0 linhas → [] em 1 chamada", async () => {
    const { fetchPage, calls } = makeFetcher(0);
    const out = await paginateAll(fetchPage, 10);
    expect(out).toEqual([]);
    expect(calls).toEqual([[0, 9]]);
  });

  it("menos que pageSize → todas em 1 chamada", async () => {
    const { rows, fetchPage, calls } = makeFetcher(7);
    const out = await paginateAll(fetchPage, 10);
    expect(out).toEqual(rows);
    expect(calls).toHaveLength(1);
  });

  it("total não-múltiplo → todas as linhas, para na página curta", async () => {
    const { rows, fetchPage, calls } = makeFetcher(25);
    const out = await paginateAll(fetchPage, 10);
    expect(out).toEqual(rows);
    expect(out).toHaveLength(25);
    expect(calls).toEqual([[0, 9], [10, 19], [20, 29]]);
  });

  it("total múltiplo exato → última página vazia encerra, sem repetir/pular", async () => {
    const { rows, fetchPage, calls } = makeFetcher(20);
    const out = await paginateAll(fetchPage, 10);
    expect(out).toEqual(rows);
    expect(out).toHaveLength(20);
    expect(calls).toEqual([[0, 9], [10, 19], [20, 29]]);
  });

  it("preserva a ordem das páginas", async () => {
    const { fetchPage } = makeFetcher(25);
    const out = await paginateAll(fetchPage, 10);
    expect(out).toEqual([...Array(25).keys()]);
  });
});
