const TZ = "America/Sao_Paulo";

function saoPauloYmd(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function utcMidnightOfSaoPauloDay(y: number, m: number, d: number): Date {
  // Brasil sem horário de verão desde 2019: SP = UTC-3 fixo.
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0));
}

export function saoPauloDayRange(
  ref: Date = new Date(),
): { startUtc: Date; endUtc: Date } {
  const { y, m, d } = saoPauloYmd(ref);
  const startUtc = utcMidnightOfSaoPauloDay(y, m, d);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc, endUtc };
}

export function formatKickoff(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}

export function formatSaoPauloDayLabel(
  date: Date,
  opts: { isToday?: boolean } = {},
): string {
  const dm = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replace(".", "")
    .replace(" de ", " ")
    .replace(/^0/, "");
  if (opts.isToday) return `Hoje · ${dm}`;
  const wd = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "short",
  })
    .format(date)
    .replace(".", "")
    .toLowerCase();
  return `${wd}, ${dm}`;
}
