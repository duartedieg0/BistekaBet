import { describe, it, expect } from "vitest";
import { formatCountdown } from "@/app/(authenticated)/inicio/_lib/format-countdown";

describe("formatCountdown", () => {
  it(">= 1h: HH:MM:SS com zero-pad", () => {
    expect(formatCountdown(2 * 3600_000 + 43 * 60_000 + 17 * 1000)).toBe("02:43:17");
    expect(formatCountdown(60 * 60_000)).toBe("01:00:00");
    expect(formatCountdown(10 * 3600_000)).toBe("10:00:00");
  });

  it("< 1h e >= 0: MM:SS", () => {
    expect(formatCountdown(43 * 60_000 + 17 * 1000)).toBe("43:17");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(999)).toBe("00:00");
  });

  it("ms negativo: 00:00", () => {
    expect(formatCountdown(-1)).toBe("00:00");
    expect(formatCountdown(-99999)).toBe("00:00");
  });
});
