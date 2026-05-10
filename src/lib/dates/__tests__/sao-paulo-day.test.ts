import { describe, it, expect } from "vitest";
import {
  saoPauloDayRange,
  formatSaoPauloDayLabel,
} from "@/lib/dates/sao-paulo-day";
import { formatKickoff } from "../sao-paulo-day";

describe("saoPauloDayRange", () => {
  it("retorna início e fim do dia em SP convertidos para UTC", () => {
    const ref = new Date("2026-06-12T14:00:00Z");
    const { startUtc, endUtc } = saoPauloDayRange(ref);
    expect(startUtc.toISOString()).toBe("2026-06-12T03:00:00.000Z");
    expect(endUtc.toISOString()).toBe("2026-06-13T03:00:00.000Z");
  });

  it("01:00 UTC ainda é 'ontem' em SP — range é o dia anterior em SP", () => {
    const ref = new Date("2026-06-12T01:00:00Z");
    const { startUtc, endUtc } = saoPauloDayRange(ref);
    expect(startUtc.toISOString()).toBe("2026-06-11T03:00:00.000Z");
    expect(endUtc.toISOString()).toBe("2026-06-12T03:00:00.000Z");
  });

  it("range tem exatamente 24h", () => {
    const { startUtc, endUtc } = saoPauloDayRange(new Date("2026-06-12T14:00:00Z"));
    expect(endUtc.getTime() - startUtc.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("formatSaoPauloDayLabel", () => {
  it("retorna 'Hoje · 12 jun' quando isToday=true", () => {
    const d = new Date("2026-06-12T14:00:00Z");
    expect(formatSaoPauloDayLabel(d, { isToday: true })).toBe("Hoje · 12 jun");
  });

  it("retorna formato curto 'sex, 12 jun' quando isToday=false", () => {
    const d = new Date("2026-06-12T14:00:00Z");
    expect(formatSaoPauloDayLabel(d, { isToday: false })).toBe("sex, 12 jun");
  });
});

describe("formatKickoff", () => {
  it("formats UTC ISO into 'dd/MM HH:mm' in BRT", () => {
    expect(formatKickoff("2026-06-15T19:00:00Z")).toBe("15/06 16:00");
  });

  it("handles BRT day rollover (23:00 BRT = 02:00 UTC next day)", () => {
    expect(formatKickoff("2026-06-16T02:00:00Z")).toBe("15/06 23:00");
  });

  it("formats midnight BRT correctly", () => {
    expect(formatKickoff("2026-06-16T03:00:00Z")).toBe("16/06 00:00");
  });
});
