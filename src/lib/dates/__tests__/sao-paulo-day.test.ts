import { describe, it, expect } from "vitest";
import {
  saoPauloDayRange,
  formatSaoPauloDayLabel,
} from "@/lib/dates/sao-paulo-day";

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
