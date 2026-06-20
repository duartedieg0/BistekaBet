/**
 * Busca todas as linhas de uma fonte paginada por offset, contornando o teto
 * de `db-max-rows` (1000) do PostgREST.
 *
 * `fetchPage(from, to)` deve retornar a página `[from, to]` inclusiva e lançar
 * em caso de erro. O laço encerra quando uma página retorna menos que
 * `pageSize` linhas (cobre total múltiplo exato: a próxima página vem vazia).
 */
export async function paginateAll<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const page = await fetchPage(from, from + pageSize - 1);
    all.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
