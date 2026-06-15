function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function filterByName<T extends { display_name: string }>(
  rows: T[],
  query: string,
): T[] {
  const q = normalize(query.trim());
  if (q === "") return rows;
  return rows.filter((r) => normalize(r.display_name).includes(q));
}
