const SP_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type MatchLike = { id: string; kickoff_at: string };

export function todayInSaoPaulo(now: Date = new Date()): string {
  return SP_FORMATTER.format(now);
}

export function toSaoPauloDate(kickoffAt: string): string {
  return SP_FORMATTER.format(new Date(kickoffAt));
}

export function bucketMatchesByDate<T extends MatchLike>(
  matches: readonly T[],
): Array<{ date: string; count: number }> {
  const counts = new Map<string, number>();
  for (const m of matches) {
    const d = toSaoPauloDate(m.kickoff_at);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function filterMatchesByDate<T extends MatchLike>(
  matches: readonly T[],
  date: string,
): T[] {
  return matches.filter((m) => toSaoPauloDate(m.kickoff_at) === date);
}
